param([string]$BaseUrl = 'http://127.0.0.1:5188', [switch]$ConfiguredTransfer)

$ErrorActionPreference = 'Stop'
if (-not $env:PARKING_TEST_ADMIN_EMAIL -or -not $env:PARKING_TEST_ADMIN_PASSWORD) {
    throw 'Set PARKING_TEST_ADMIN_EMAIL and PARKING_TEST_ADMIN_PASSWORD for the isolated test database.'
}

function CallApi($method, $path, $body = $null, $token = $null) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $args = @{ Uri = "$BaseUrl$path"; Method = $method; Headers = $headers; SkipHttpErrorCheck = $true }
    if ($null -ne $body) {
        $args['ContentType'] = 'application/json'
        $args['Body'] = ConvertTo-Json -InputObject $body -Compress
    }
    $response = Invoke-WebRequest @args
    $data = $null
    if ($response.Content) {
        $content = if ($response.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($response.Content) } else { $response.Content }
        try { $data = $content | ConvertFrom-Json -ErrorAction Stop }
        catch { $data = $content }
    }
    return @{ Status = [int]$response.StatusCode; Data = $data }
}

function Expect($actual, $expected, $label) {
    if ($actual -ne $expected) { throw "$label`: expected $expected, got $actual" }
    Write-Output "PASS $label ($actual)"
}

function GetTotp([string]$key, [int]$offsetSeconds = 0) {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    $bytes = [System.Collections.Generic.List[byte]]::new()
    $bits = 0
    $value = 0
    foreach ($character in $key.TrimEnd('=').ToUpperInvariant().ToCharArray()) {
        $value = ($value -shl 5) -bor $alphabet.IndexOf($character)
        $bits += 5
        if ($bits -ge 8) {
            $bits -= 8
            $bytes.Add([byte](($value -shr $bits) -band 255))
            $value = $value -band ((1 -shl $bits) - 1)
        }
    }
    $counter = [long][Math]::Floor(([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + $offsetSeconds) / 30)
    $message = [BitConverter]::GetBytes($counter)
    if ([BitConverter]::IsLittleEndian) { [Array]::Reverse($message) }
    $hmac = [System.Security.Cryptography.HMACSHA1]::new($bytes.ToArray())
    try { $digest = $hmac.ComputeHash($message) } finally { $hmac.Dispose() }
    $i = $digest[-1] -band 15
    $code = (([int]$digest[$i] -band 127) -shl 24) -bor ([int]$digest[$i + 1] -shl 16) -bor ([int]$digest[$i + 2] -shl 8) -bor [int]$digest[$i + 3]
    return ($code % 1000000).ToString('D6')
}

$adminLogin = CallApi 'POST' '/api/auth/login?useCookies=false' @{
    email = $env:PARKING_TEST_ADMIN_EMAIL; password = $env:PARKING_TEST_ADMIN_PASSWORD
}
Expect $adminLogin.Status 200 'admin login'
$adminToken = $adminLogin.Data.accessToken
if (-not $adminToken) { throw 'Admin bearer token missing' }
Expect (CallApi 'GET' '/api/me' $null $adminToken).Status 200 'admin profile'
$startingRevenue = (CallApi 'GET' '/api/dashboard/summary' $null $adminToken).Data.revenueToday

$suffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
$email = "smoke-$suffix@example.test"
$password = "Smoke!$suffix`9"
Expect (CallApi 'POST' '/api/auth/register' @{ email = $email; password = $password }).Status 200 'customer register'
$login = CallApi 'POST' '/api/auth/login?useCookies=false' @{ email = $email; password = $password }
Expect $login.Status 200 'customer login'
$customerToken = $login.Data.accessToken
if (-not $customerToken) { throw 'Customer bearer token missing' }
Expect (CallApi 'GET' '/api/me' $null $customerToken).Status 200 'customer profile'
Expect (CallApi 'PUT' '/api/me' @{ displayName = 'No session' }).Status 401 'profile changes require login'
Expect (CallApi 'PUT' '/api/me' @{ contactPhone = 'not a phone' } $customerToken).Status 400 'invalid phone is rejected'
$saved = CallApi 'PUT' '/api/me' @{ displayName = '  Parking Test  '; contactPhone = '+84901234567'; email = 'changed@example.test'; roles = @('Admin') } $customerToken
Expect $saved.Status 200 'customer saves own profile'
Expect $saved.Data.displayName 'Parking Test' 'display name trimmed'
Expect $saved.Data.contactPhone '+84901234567' 'phone saved'
Expect $saved.Data.email $email 'profile save cannot change login email'
Expect @($saved.Data.roles).Count 0 'profile save cannot assign roles'
Expect (CallApi 'GET' '/api/me' $null $customerToken).Data.displayName 'Parking Test' 'profile persists on reload'
Expect (CallApi 'GET' '/api/me' $null $adminToken).Data.displayName $null 'customer data isolated from admin account'
Expect (CallApi 'PUT' '/api/me' @{ displayName = $null; contactPhone = $null } $customerToken).Status 200 'optional profile fields can be cleared'

Expect (CallApi 'POST' '/api/parking-lots' @{ name = 'Forbidden'; address = 'Forbidden' } $customerToken).Status 403 'customer cannot create lot'
Expect (CallApi 'GET' '/api/dashboard/summary' $null $customerToken).Status 403 'customer cannot read dashboard'
Expect (CallApi 'GET' '/api/vehicles/mine').Status 401 'anonymous vehicles denied'

$assigned = CallApi 'POST' '/api/admin/staff' @{ email = $email } $adminToken
Expect $assigned.Status 200 'admin assigns staff'
Expect (CallApi 'GET' '/api/admin/staff' $null $adminToken).Status 200 'admin lists staff'
Expect (CallApi 'POST' '/api/admin/staff' @{ email = $email } $customerToken).Status 403 'staff cannot assign staff'
$staffLogin = CallApi 'POST' '/api/auth/login?useCookies=false' @{ email = $email; password = $password }
Expect $staffLogin.Status 200 'staff login after role change'
$staffToken = $staffLogin.Data.accessToken

$lot = CallApi 'POST' '/api/parking-lots' @{ name = "Smoke lot $suffix"; address = 'Isolated test DB' } $adminToken
Expect $lot.Status 201 'admin create lot'
$spot = CallApi 'POST' '/api/parking-spots' @{ parkingLotId = $lot.Data.id; code = 'M01'; type = 1 } $adminToken
Expect $spot.Status 201 'admin create spot'
$otherLot = CallApi 'POST' '/api/parking-lots' @{ name = "Other lot $suffix"; address = 'Isolated test DB' } $adminToken
Expect $otherLot.Status 201 'admin creates a second lot'
$otherSpot = CallApi 'POST' '/api/parking-spots' @{ parkingLotId = $otherLot.Data.id; code = 'M02'; type = 1 } $adminToken
Expect $otherSpot.Status 201 'admin can create a spot at any lot'
$assignedPath = '/api/parking-lots/assigned'
Expect (CallApi 'GET' $assignedPath $null $customerToken).Status 403 'customers cannot read the operational catalog'
Expect @((CallApi 'GET' $assignedPath $null $staffToken).Data).Count 0 'unassigned staff sees no lots'
$adminLotIds = @((CallApi 'GET' $assignedPath $null $adminToken).Data | ForEach-Object id)
Expect ($adminLotIds -contains $lot.Data.id -and $adminLotIds -contains $otherLot.Data.id) $true 'admin sees both lots'
$vehicle = CallApi 'POST' '/api/vehicles' @{ plateNumber = "T$suffix"; type = 1 } $customerToken
Expect $vehicle.Status 201 'customer create vehicle'
Expect (CallApi 'GET' "/api/vehicles/search?plate=T$suffix" $null $staffToken).Status 200 'staff searches plate'
Expect (CallApi 'POST' '/api/vehicles' @{ plateNumber = "T$suffix"; type = 1 } $customerToken).Status 409 'duplicate plate denied'

$start = [DateTime]::UtcNow.AddMinutes(2).ToString('O')
$end = ([DateTime]$start).ToUniversalTime().AddDays(3).ToString('O')
$estimatePath = "/api/pricing/estimate?vehicleType=1&startUtc=$([uri]::EscapeDataString($start))&endUtc=$([uri]::EscapeDataString($end))"
$estimate = CallApi 'GET' $estimatePath
Expect $estimate.Status 200 'booking can preview fees for three days'
Expect $estimate.Data.billableHours 72 'planned stay uses the full duration'
$request = @{ vehicleId = $vehicle.Data.id; parkingSpotId = $spot.Data.id; startUtc = $start; endUtc = $end; expectedFee = $estimate.Data.total; expectedDeposit = $estimate.Data.depositAmount; requestId = [guid]::NewGuid().ToString() }
$wrongFee = $request.Clone()
$wrongFee.expectedFee = $estimate.Data.total + 1
Expect (CallApi 'POST' '/api/reservations' $wrongFee $customerToken).Status 409 'customer must see the current booking estimate'
$tooLong = $request.Clone()
$tooLong.endUtc = ([DateTime]$start).ToUniversalTime().AddDays(31).ToString('O')
Expect (CallApi 'POST' '/api/reservations' $tooLong $customerToken).Status 400 'reservations above 30 days are rejected'
Expect (CallApi 'POST' '/api/reservations' $request $customerToken).Status 409 'insufficient available balance blocks booking'
Expect (CallApi 'PUT' "/api/admin/staff/$($assigned.Data.id)/lots" @{ parkingLotIds = @($lot.Data.id) } $adminToken).Status 204 'admin assigns staff to lot'
$myParkedPath = '/api/parking-sessions/mine/active'
Expect (CallApi 'GET' $myParkedPath).Status 401 'parked vehicles require login'
Expect (CallApi 'GET' "/api/parking-spots/map?parkingLotId=$($lot.Data.id)").Status 200 'public spot map'
Expect (CallApi 'POST' '/api/parking-sessions/check-in' @{
    vehicleId = $vehicle.Data.id; parkingSpotId = $otherSpot.Data.id
} $staffToken).Status 400 'staff cannot check in through an unassigned lot'

$checkIn = CallApi 'POST' '/api/parking-sessions/check-in' @{
    vehicleId = $vehicle.Data.id; parkingSpotId = $spot.Data.id
} $staffToken
Expect $checkIn.Status 201 'staff check in'
$parked = CallApi 'GET' $myParkedPath $null $customerToken
Expect $parked.Status 200 'owner locates parked vehicle'
Expect @($parked.Data).Count 1 'one parked vehicle'
Expect $parked.Data[0].id $checkIn.Data.id 'position comes from active check-in'
Expect $parked.Data[0].parkingSpotId $spot.Data.id 'actual parking spot ID returned'
Expect $parked.Data[0].spotCode 'M01' 'actual parking code returned'
Expect $parked.Data[0].lotId $lot.Data.id 'actual lot ID returned'
Expect $parked.Data[0].lotName $lot.Data.name 'actual lot name returned'
Expect $parked.Data[0].plateNumber $vehicle.Data.plateNumber 'owner sees own plate'
Expect @((CallApi 'GET' $myParkedPath $null $adminToken).Data).Count 0 'personal location does not return another account vehicle'
$occupiedMap = CallApi 'GET' "/api/parking-spots/map?parkingLotId=$($lot.Data.id)"
if ($occupiedMap.Data[0].status -ne 'Occupied') { throw 'Spot map did not show Occupied' }
Write-Output 'PASS occupied spot status'
Expect (CallApi 'POST' '/api/parking-sessions/check-in' @{
    vehicleId = $vehicle.Data.id; parkingSpotId = $spot.Data.id
} $staffToken).Status 409 'duplicate active session denied'
Expect (CallApi 'GET' '/api/parking-sessions/mine' $null $customerToken).Status 200 'customer session history'
$checkOut = CallApi 'POST' "/api/parking-sessions/$($checkIn.Data.id)/check-out" $null $staffToken
Expect $checkOut.Status 200 'staff check out'
Expect @((CallApi 'GET' $myParkedPath $null $customerToken).Data).Count 0 'location removed once checked out'
Expect (CallApi 'GET' '/api/parking-sessions/unpaid' $null $staffToken).Status 200 'staff lists unpaid sessions'
if ($checkOut.Data.fee -ne 5000) { throw "Unexpected fee: $($checkOut.Data.fee)" }
Write-Output 'PASS one-hour motorbike fee (5000)'
$paymentPath = "/api/payments/parking-session/$($checkIn.Data.id)"
Expect (CallApi 'GET' '/api/payments/mine').Status 401 'payment history requires login'
$customerBill = (CallApi 'GET' '/api/payments/mine' $null $customerToken).Data
Expect $customerBill[0].sessionId $checkIn.Data.id 'customer sees own unpaid parking fee'
Expect $customerBill[0].amount 5000 'customer sees exact fee for checkout'
Expect $customerBill[0].paidAtUtc $null 'unpaid fee has no receipt timestamp'
Expect @((CallApi 'GET' '/api/payments/mine' $null $adminToken).Data).Count 0 'personal bills exclude another account'
$ownerTransfer = CallApi 'GET' "$paymentPath/transfer" $null $customerToken
Expect $ownerTransfer.Status 200 'customer can read payment details for own session'
Expect $ownerTransfer.Data.amount 5000 'owner transfer amount matches invoice'
Expect (CallApi 'POST' $paymentPath @{ method = 1 } $customerToken).Status 403 'customer cannot mark own payment paid'
$transfer = CallApi 'GET' "$paymentPath/transfer" $null $staffToken
Expect $transfer.Status 200 'staff can read transfer details'
Expect $transfer.Data.enabled ([bool]$ConfiguredTransfer) 'QR availability matches configuration'
Expect (CallApi 'POST' $paymentPath @{ method = 3 } $staffToken).Status 400 'transfer requires an audited reference'
if ($ConfiguredTransfer) {
    if ($transfer.Data.payload -notmatch '^00020101021238.*540450005802VN.*6304[0-9A-F]{4}$') { throw 'Invalid VietQR envelope or amount' }
    $pay = CallApi 'POST' $paymentPath @{ method = 3; note = "TEST$suffix" } $staffToken
    Expect $pay.Status 201 'staff record verified transfer'
} else {
    $pay = CallApi 'POST' $paymentPath @{ method = 1 } $staffToken
    Expect $pay.Status 201 'staff record cash payment'
}
$unpaidAfterPay = CallApi 'GET' '/api/parking-sessions/unpaid' $null $staffToken
if (@($unpaidAfterPay.Data).Count -ne 0) { throw 'Paid session still appears as unpaid' }
Write-Output 'PASS paid session removed from unpaid list'
Expect (CallApi 'POST' "/api/payments/parking-session/$($checkIn.Data.id)" @{ method = 1 } $staffToken).Status 409 'duplicate payment denied'
$otherSession = CallApi 'POST' '/api/parking-sessions/check-in' @{
    vehicleId = $vehicle.Data.id; parkingSpotId = $otherSpot.Data.id
} $adminToken
Expect $otherSession.Status 201 'admin can check in through the other lot'
Expect @((CallApi 'GET' '/api/parking-sessions/active' $null $staffToken).Data).Count 0 'staff active list excludes the other lot'
Expect (CallApi 'POST' "/api/parking-sessions/$($otherSession.Data.id)/check-out" $null $staffToken).Status 404 'staff cannot check out a vehicle in the other lot'
$customerExit = "/api/parking-sessions/mine/$($otherSession.Data.id)"
Expect (CallApi 'GET' "$customerExit/checkout-quote" $null $adminToken).Status 404 'another user cannot preview a private fee'
$exitQuote = CallApi 'GET' "$customerExit/checkout-quote" $null $customerToken
Expect $exitQuote.Data.charge.total 5000 'owner previews the walk-in charge'
Expect (CallApi 'POST' "$customerExit/check-out" @{ expectedFee = 5001 } $customerToken).Status 409 'customer must accept the current fee'
Expect (CallApi 'POST' "$customerExit/check-out" @{ expectedFee = 5000 } $adminToken).Status 404 'another user cannot confirm departure'
Expect (CallApi 'POST' "$customerExit/check-out" @{ expectedFee = 5000 } $customerToken).Status 200 'owner confirms departure'
Expect (CallApi 'POST' "$customerExit/check-out" @{ expectedFee = 5000 } $customerToken).Data.fee 5000 'owner departure retry returns the settled fee'
Expect @((CallApi 'GET' '/api/parking-sessions/unpaid' $null $staffToken).Data).Count 0 'staff unpaid list excludes the other lot'
Expect (CallApi 'POST' "/api/payments/parking-session/$($otherSession.Data.id)" @{ method = 1 } $staffToken).Status 404 'staff cannot record payment in the other lot'
Expect (CallApi 'GET' "$paymentPath/transfer" $null $customerToken).Status 409 'paid session no longer issues transfer QR'
$receipt = (CallApi 'GET' '/api/payments/mine' $null $customerToken).Data | Where-Object sessionId -eq $checkIn.Data.id
Expect ([bool]$receipt.paidAtUtc) $true 'customer can read updated receipt'
Expect $receipt.paymentMethod $pay.Data.method 'customer receipt displays actual payment method'

if ($ConfiguredTransfer) {
    $walletPath = '/api/wallet/mine'
    Expect (CallApi 'GET' $walletPath).Status 401 'wallet requires login'
    Expect (CallApi 'GET' $walletPath $null $customerToken).Data.balance 0 'new wallet starts at zero'
    $createTopUp = @{ requestId = [guid]::NewGuid().ToString(); amount = 5000 }
    $topUp = CallApi 'POST' '/api/wallet/top-ups' $createTopUp $customerToken
    Expect $topUp.Status 201 'customer requests top-up'
    Expect (CallApi 'POST' '/api/wallet/top-ups' $createTopUp $customerToken).Data.id $topUp.Data.id 'top-up request can be retried'
    if (-not $topUp.Data.payload.Contains('54045000') -or -not $topUp.Data.payload.Contains($topUp.Data.transferReference)) { throw 'Top-up QR omitted the amount or reference' }
    $approvePath = "/api/wallet/top-ups/$($topUp.Data.id)/approve"
    $approval = @{ receivedAmount = 5000; bankTransactionCode = "TOP$suffix" }
    Expect (CallApi 'POST' $approvePath $approval $staffToken).Status 403 'staff cannot credit wallet'
    Expect (CallApi 'GET' $walletPath $null $customerToken).Data.balance 0 'pending top-up does not credit wallet'
    Expect (CallApi 'POST' $approvePath @{ receivedAmount = 4000; bankTransactionCode = "TOP$suffix" } $adminToken).Status 400 'wrong received amount is rejected'
    Expect (CallApi 'POST' $approvePath @{ receivedAmount = 5000; bankTransactionCode = "test$suffix" } $adminToken).Status 409 'previous bank payment cannot also credit a wallet'
    Expect (CallApi 'POST' $approvePath $approval $adminToken).Status 204 'admin credits reconciled top-up'
    Expect (CallApi 'POST' $approvePath $approval $adminToken).Status 204 'retry does not duplicate credit'
    Expect (CallApi 'GET' $walletPath $null $customerToken).Data.balance 5000 'credited balance is exact'
    Expect (CallApi 'GET' $walletPath $null $adminToken).Data.balance 0 'wallet belongs to its owner'

    $request.startUtc = [DateTime]::UtcNow.AddHours(1).ToString('O')
    $request.endUtc = ([DateTime]$request.startUtc).ToUniversalTime().AddDays(3).ToString('O')
    $request.startUtc = ([datetime]$request.startUtc).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $request.endUtc = ([datetime]$request.endUtc).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $attempts = 1..2 | ForEach-Object -Parallel {
        $body = ($using:request).Clone()
        $body.requestId = [guid]::NewGuid().ToString()
        $response = Invoke-WebRequest -Method Post -Uri ($using:BaseUrl + '/api/reservations') -ContentType 'application/json' -Body ($body | ConvertTo-Json) -Headers @{ Authorization = 'Bearer ' + $using:customerToken } -SkipHttpErrorCheck
        [pscustomobject]@{ Status = [int]$response.StatusCode; RequestId = $body.requestId }
    }
    Expect @($attempts | Where-Object Status -eq 201).Count 1 'one simultaneous booking acquires spot and deposit'
    Expect @($attempts | Where-Object Status -eq 409).Count 1 'competing booking cannot acquire a second hold'
    $request.requestId = ($attempts | Where-Object Status -eq 201).RequestId
    $reservation = CallApi 'POST' '/api/reservations' $request $customerToken
    Expect $reservation.Status 200 'retry finds same booking'
    Expect $reservation.Data.status 1 'wallet deposit confirms reservation immediately'
    Expect (CallApi 'GET' $walletPath $null $customerToken).Data.heldDeposit 5000 'one deposit is held'
    Expect (CallApi 'GET' $walletPath $null $customerToken).Data.balance 0 'held funds cannot be spent'
    $upcoming = CallApi 'GET' '/api/reservations/upcoming' $null $staffToken
    Expect ($upcoming.Data.id -contains $reservation.Data.id) $true 'assigned staff sees confirmed booking'
    Expect (CallApi 'POST' "/api/reservations/$($reservation.Data.id)/cancel" $null $customerToken).Status 204 'owner cancels before arrival'
    Expect (CallApi 'GET' $walletPath $null $customerToken).Data.balance 5000 'timely cancellation refunds hold'
    $request.requestId = [guid]::NewGuid().ToString()
    $reservation = CallApi 'POST' '/api/reservations' $request $customerToken
    Expect $reservation.Status 201 'released spot can be booked again'
    Expect (CallApi 'POST' "/api/reservations/$($reservation.Data.id)/release" $null $staffToken).Status 204 'lot cancellation succeeds'
    Expect (CallApi 'GET' $walletPath $null $customerToken).Data.balance 5000 'lot cancellation releases deposit'
    $otherPaymentPath = "/api/payments/parking-session/$($otherSession.Data.id)"
    Expect (CallApi 'POST' $otherPaymentPath @{ method = 3; note = "top$suffix" } $adminToken).Status 409 'top-up receipt cannot also pay a parking bill'
    Expect (CallApi 'POST' "$otherPaymentPath/balance" $null $adminToken).Status 404 'admin cannot debit an unrelated balance'
    $nextSession = CallApi 'POST' '/api/parking-sessions/check-in' @{ vehicleId = $vehicle.Data.id; parkingSpotId = $otherSpot.Data.id } $adminToken
    Expect $nextSession.Status 201 'creates a second unpaid bill for the race test'
    Expect (CallApi 'POST' "/api/parking-sessions/$($nextSession.Data.id)/check-out" $null $adminToken).Status 200 'second bill is ready for payment'
    $billedSessions = @($otherSession.Data.id, $nextSession.Data.id)
    $attempts = $billedSessions | ForEach-Object -Parallel {
        $headers = @{ Authorization = 'Bearer ' + $using:customerToken }
        $path = $using:BaseUrl + "/api/payments/parking-session/$_/balance"
        $response = Invoke-WebRequest -Method POST -Uri $path -Headers $headers -SkipHttpErrorCheck
        [pscustomobject]@{ SessionId = $_; Status = [int]$response.StatusCode }
    }
    Expect @($attempts | Where-Object Status -eq 204).Count 1 'only one simultaneous purchase uses the same balance'
    Expect @($attempts | Where-Object Status -eq 409).Count 1 'second purchase is rejected when balance is exhausted'
    $paidWithBalance = ($attempts | Where-Object Status -eq 204).SessionId
    Expect (CallApi 'POST' "/api/payments/parking-session/$paidWithBalance/balance" $null $customerToken).Status 204 'wallet payment can be retried safely'
    Expect (CallApi 'GET' $walletPath $null $customerToken).Data.balance 0 'purchase debits balance once'
    $balanceReceipt = (CallApi 'GET' '/api/payments/mine' $null $customerToken).Data | Where-Object sessionId -eq $paidWithBalance
    Expect $balanceReceipt.paymentMethod 4 'receipt identifies balance payment'
}

$summary = CallApi 'GET' '/api/dashboard/summary' $null $adminToken
Expect $summary.Status 200 'admin dashboard'
$expectedRevenue = $startingRevenue + $(if ($ConfiguredTransfer) { 10000 } else { 5000 })
Expect $summary.Data.revenueToday $expectedRevenue 'dashboard counts parking payments and excludes top-up credits'

$reportDate = [DateTime]::UtcNow.AddHours(7).ToString('yyyy-MM-dd')
$revenuePath = "/api/dashboard/revenue?lotId=$($lot.Data.id)&period=day&date=$reportDate"
$otherRevenuePath = "/api/dashboard/revenue?lotId=$($otherLot.Data.id)&period=day&date=$reportDate"
Expect (CallApi 'GET' $revenuePath $null $customerToken).Status 403 'customer cannot see operational revenue'
Expect (CallApi 'GET' $otherRevenuePath $null $staffToken).Status 404 'staff cannot read another lot revenue'
Expect (CallApi 'GET' $otherRevenuePath $null $adminToken).Status 200 'admin can view another lot revenue'
$dayReport = (CallApi 'GET' $revenuePath $null $staffToken).Data
Expect $dayReport.lot.id $lot.Data.id 'report is for the selected assigned lot'
Expect $dayReport.revenue 5000 'lot revenue only includes paid parking fees'
Expect $dayReport.paymentCount 1 'report counts settled parking payments'
Expect $dayReport.periods.Count 24 'daily report contains one bucket per hour'
$expectedHour = ([DateTimeOffset]$pay.Data.paidAtUtc).ToOffset([TimeSpan]::FromHours(7)).Hour
Expect $dayReport.periods[$expectedHour].revenue 5000 'daily report buckets payment in Vietnam time'
Expect $dayReport.periods[$expectedHour].methods[0].method $pay.Data.method 'hour breakout includes payment method'
$monthReport = (CallApi 'GET' "/api/dashboard/revenue?lotId=$($lot.Data.id)&period=month&date=2024-02-20" $null $staffToken).Data
Expect $monthReport.periods.Count 29 'monthly report includes leap day'
Expect $monthReport.revenue 0 'empty month returns zero revenue'
$yearReport = (CallApi 'GET' "/api/dashboard/revenue?lotId=$($lot.Data.id)&period=year&date=$reportDate" $null $staffToken).Data
Expect $yearReport.periods.Count 12 'yearly report contains twelve months'
Expect $yearReport.revenue $dayReport.revenue 'yearly report agrees with daily revenue on fresh test lot'
Expect (CallApi 'GET' "/api/dashboard/revenue?lotId=$($lot.Data.id)&period=week&date=$reportDate" $null $staffToken).Status 400 'invalid period returns a validation error'

Expect (CallApi 'DELETE' "/api/admin/staff/$($assigned.Data.id)" $null $adminToken).Status 204 'admin revokes staff'
$relogin = CallApi 'POST' '/api/auth/login?useCookies=false' @{ email = $email; password = $password }
Expect $relogin.Status 200 'customer login after revoke'
Expect (CallApi 'GET' '/api/dashboard/summary' $null $relogin.Data.accessToken).Status 403 'revoked staff cannot read dashboard'

$security = '/api/security/authenticator'
$loginPath = '/api/auth/login?useCookies=false'
$customerToken = $relogin.Data.accessToken
Expect (CallApi 'POST' "$security/setup" @{ password = 'wrong' } $customerToken).Status 401 '2FA setup requires password'
Expect (CallApi 'POST' '/api/auth/manage/2fa' @{} $customerToken).Status 404 'raw 2FA endpoint unavailable'
$setup = CallApi 'POST' "$security/setup" @{ password = $password } $customerToken
Expect $setup.Status 200 '2FA setup'
$key = $setup.Data.sharedKey
Expect (CallApi 'POST' "$security/enable" @{ password = $password; code = 'abc123' } $customerToken).Status 400 '2FA rejects invalid code'
$enabled = CallApi 'POST' "$security/enable" @{ password = $password; code = (GetTotp $key) } $customerToken
Expect $enabled.Status 200 '2FA enabled with valid OTP'
Expect @($enabled.Data.recoveryCodes).Count 10 'recovery codes created'
Expect (CallApi 'POST' "$security/setup" @{ password = $password } $customerToken).Status 409 'enabled secret cannot be retrieved'
$challenge = CallApi 'POST' $loginPath @{ email = $email; password = $password }
Expect $challenge.Status 401 'password alone no longer signs in'
Expect $challenge.Data.detail 'RequiresTwoFactor' 'Identity signals OTP challenge'
$signedIn = CallApi 'POST' $loginPath @{ email = $email; password = $password; twoFactorCode = (GetTotp $key) }
Expect $signedIn.Status 200 'valid OTP signs in'
$recoveryCode = $enabled.Data.recoveryCodes[0]
Expect (CallApi 'POST' $loginPath @{ email = $email; password = $password; twoFactorRecoveryCode = $recoveryCode }).Status 200 'recovery code signs in'
Expect (CallApi 'POST' $loginPath @{ email = $email; password = $password; twoFactorRecoveryCode = $recoveryCode }).Status 401 'recovery code cannot be reused'
Expect (CallApi 'POST' "$security/disable" @{ password = $password; code = (GetTotp $key) } $signedIn.Data.accessToken).Status 204 'disable OTP with current OTP'

$forecast = CallApi 'GET' "/api/parking-lots/$($lot.Data.id)/forecast"
Expect $forecast.Status 200 'forecast API public'
Expect $forecast.Data.ready $false 'forecast requires history'
