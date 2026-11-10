param([string]$BaseUrl = 'http://127.0.0.1:5188')

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
        try { $data = $response.Content | ConvertFrom-Json -ErrorAction Stop }
        catch { $data = $response.Content }
    }
    return @{ Status = [int]$response.StatusCode; Data = $data }
}

function Expect($actual, $expected, $label) {
    if ($actual -ne $expected) { throw "$label`: expected $expected, got $actual" }
    Write-Output "PASS $label ($actual)"
}

$adminLogin = CallApi 'POST' '/api/auth/login?useCookies=false' @{
    email = $env:PARKING_TEST_ADMIN_EMAIL; password = $env:PARKING_TEST_ADMIN_PASSWORD
}
Expect $adminLogin.Status 200 'admin login'
$adminToken = $adminLogin.Data.accessToken
if (-not $adminToken) { throw 'Admin bearer token missing' }

$suffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
$email = "smoke-$suffix@example.test"
$password = "Smoke!$suffix`9"
Expect (CallApi 'POST' '/api/auth/register' @{ email = $email; password = $password }).Status 200 'customer register'
$login = CallApi 'POST' '/api/auth/login?useCookies=false' @{ email = $email; password = $password }
Expect $login.Status 200 'customer login'
$customerToken = $login.Data.accessToken
if (-not $customerToken) { throw 'Customer bearer token missing' }

Expect (CallApi 'POST' '/api/parking-lots' @{ name = 'Forbidden'; address = 'Forbidden' } $customerToken).Status 403 'customer cannot create lot'
Expect (CallApi 'GET' '/api/dashboard/summary' $null $customerToken).Status 403 'customer cannot read dashboard'
Expect (CallApi 'GET' '/api/vehicles/mine').Status 401 'anonymous vehicles denied'

$assigned = CallApi 'POST' '/api/admin/staff' @{ email = $email } $adminToken
Expect $assigned.Status 200 'admin assigns staff'
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
Expect (CallApi 'POST' '/api/vehicles' @{ plateNumber = "T$suffix"; type = 1 } $customerToken).Status 409 'duplicate plate denied'

$start = [DateTime]::UtcNow.AddMinutes(2).ToString('O')
$end = [DateTime]::UtcNow.AddHours(1).ToString('O')
$request = @{ vehicleId = $vehicle.Data.id; parkingSpotId = $spot.Data.id; startUtc = $start; endUtc = $end }
$reservation = CallApi 'POST' '/api/reservations' $request $customerToken
Expect $reservation.Status 201 'customer reserve spot'
Expect (CallApi 'POST' '/api/reservations' $request $customerToken).Status 409 'overlap denied'
Expect (CallApi 'POST' "/api/reservations/$($reservation.Data.id)/cancel" $null $customerToken).Status 204 'customer cancel reservation'

$checkIn = CallApi 'POST' '/api/parking-sessions/check-in' @{
    vehicleId = $vehicle.Data.id; parkingSpotId = $spot.Data.id
} $staffToken
Expect $checkIn.Status 201 'staff check in'
Expect (CallApi 'POST' '/api/parking-sessions/check-in' @{
    vehicleId = $vehicle.Data.id; parkingSpotId = $spot.Data.id
} $staffToken).Status 409 'duplicate active session denied'
Expect (CallApi 'GET' '/api/parking-sessions/mine' $null $customerToken).Status 200 'customer session history'
$checkOut = CallApi 'POST' "/api/parking-sessions/$($checkIn.Data.id)/check-out" $null $staffToken
Expect $checkOut.Status 200 'staff check out'
if ($checkOut.Data.fee -ne 5000) { throw "Unexpected fee: $($checkOut.Data.fee)" }
Write-Output 'PASS one-hour motorbike fee (5000)'
$pay = CallApi 'POST' "/api/payments/parking-session/$($checkIn.Data.id)" @{ method = 1 } $staffToken
Expect $pay.Status 201 'staff record cash payment'
Expect (CallApi 'POST' "/api/payments/parking-session/$($checkIn.Data.id)" @{ method = 1 } $staffToken).Status 409 'duplicate payment denied'
$summary = CallApi 'GET' '/api/dashboard/summary' $null $adminToken
Expect $summary.Status 200 'admin dashboard'
if ($summary.Data.revenueToday -ne 5000) { throw 'Dashboard revenue mismatch' }
Write-Output 'PASS dashboard revenue (5000)'
Expect (CallApi 'DELETE' "/api/admin/staff/$($assigned.Data.id)" $null $adminToken).Status 204 'admin revokes staff'
$relogin = CallApi 'POST' '/api/auth/login?useCookies=false' @{ email = $email; password = $password }
Expect $relogin.Status 200 'customer login after revoke'
Expect (CallApi 'GET' '/api/dashboard/summary' $null $relogin.Data.accessToken).Status 403 'revoked staff cannot read dashboard'
