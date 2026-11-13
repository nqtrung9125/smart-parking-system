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
$vehicle = CallApi 'POST' '/api/vehicles' @{ plateNumber = "T$suffix"; type = 1 } $customerToken
Expect $vehicle.Status 201 'customer create vehicle'
Expect (CallApi 'GET' "/api/vehicles/search?plate=T$suffix" $null $staffToken).Status 200 'staff searches plate'
Expect (CallApi 'POST' '/api/vehicles' @{ plateNumber = "T$suffix"; type = 1 } $customerToken).Status 409 'duplicate plate denied'

$start = [DateTime]::UtcNow.AddMinutes(2).ToString('O')
$end = [DateTime]::UtcNow.AddHours(1).ToString('O')
$request = @{ vehicleId = $vehicle.Data.id; parkingSpotId = $spot.Data.id; startUtc = $start; endUtc = $end }
$reservation = CallApi 'POST' '/api/reservations' $request $customerToken
Expect $reservation.Status 201 'customer reserve spot'
Expect (CallApi 'GET' "/api/reservations/active?plate=T$suffix" $null $staffToken).Status 200 'staff searches reservation'
Expect (CallApi 'POST' '/api/reservations' $request $customerToken).Status 409 'overlap denied'
Expect (CallApi 'POST' "/api/reservations/$($reservation.Data.id)/cancel" $null $customerToken).Status 204 'customer cancel reservation'
Expect (CallApi 'GET' "/api/parking-spots/map?parkingLotId=$($lot.Data.id)").Status 200 'public spot map'

$checkIn = CallApi 'POST' '/api/parking-sessions/check-in' @{
    vehicleId = $vehicle.Data.id; parkingSpotId = $spot.Data.id
} $staffToken
Expect $checkIn.Status 201 'staff check in'
$occupiedMap = CallApi 'GET' "/api/parking-spots/map?parkingLotId=$($lot.Data.id)"
if ($occupiedMap.Data[0].status -ne 'Occupied') { throw 'Spot map did not show Occupied' }
Write-Output 'PASS occupied spot status'
Expect (CallApi 'POST' '/api/parking-sessions/check-in' @{
    vehicleId = $vehicle.Data.id; parkingSpotId = $spot.Data.id
} $staffToken).Status 409 'duplicate active session denied'
Expect (CallApi 'GET' '/api/parking-sessions/mine' $null $customerToken).Status 200 'customer session history'
$checkOut = CallApi 'POST' "/api/parking-sessions/$($checkIn.Data.id)/check-out" $null $staffToken
Expect $checkOut.Status 200 'staff check out'
Expect (CallApi 'GET' '/api/parking-sessions/unpaid' $null $staffToken).Status 200 'staff lists unpaid sessions'
if ($checkOut.Data.fee -ne 5000) { throw "Unexpected fee: $($checkOut.Data.fee)" }
Write-Output 'PASS one-hour motorbike fee (5000)'
$paymentPath = "/api/payments/parking-session/$($checkIn.Data.id)"
Expect (CallApi 'GET' "$paymentPath/transfer" $null $customerToken).Status 403 'customer cannot generate transfer QR'
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
$summary = CallApi 'GET' '/api/dashboard/summary' $null $adminToken
Expect $summary.Status 200 'admin dashboard'
if ($summary.Data.revenueToday -ne ($startingRevenue + 5000)) { throw 'Dashboard revenue mismatch' }
Write-Output 'PASS dashboard revenue (5000)'
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
