<?php

/*
 * Regenerates fixtures.json for the browser accessibility audit (T11-13) from the
 * PerformanceSeeder data (T11-09: fake people only), by calling the API's GET
 * endpoints through the HTTP kernel as each role, as `clinic:bench` does. No
 * token is created. Run from backend/ against the bench database:
 *
 *   DB_DATABASE=clinic_bench FIXTURES_OUT=../frontend/scripts/a11y-audit/fixtures.json \
 *     php artisan tinker --execute="require '../frontend/scripts/a11y-audit/dump-fixtures.php';"
 */

$kernel = app(Illuminate\Contracts\Http\Kernel::class);
$out = [];
$get = function (App\Models\User $user, string $uri, string $lang = 'ar') use ($kernel) {
    $user = App\Models\User::findOrFail($user->id);
    app('auth')->guard('sanctum')->setUser($user);
    $request = Illuminate\Http\Request::create('/api/v1'.$uri, 'GET', server: ['HTTP_ACCEPT' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => $lang]);
    $response = $kernel->handle($request);
    $kernel->terminate($request, $response);
    if ($response->getStatusCode() !== 200) {
        throw new RuntimeException("$uri -> ".$response->getStatusCode().' '.substr($response->getContent(), 0, 300));
    }

    return json_decode($response->getContent(), true);
};

$doctor = App\Models\User::clinicDoctor();
$assistant = App\Models\User::where('role', 'assistant')->firstOrFail();
// A patient with history, visits with payments, a prescription and an unpaid balance.
$patient = App\Models\Patient::query()
    ->whereHas('medicalHistoryEntries', fn ($q) => $q->where('patient_visible', true))
    ->whereHas('visits.prescriptions')
    ->whereHas('visits', fn ($q) => $q->where('visit_date', '>=', today()->subYear()))
    ->withCount('visits')->having('visits_count', '>=', 4)
    ->orderBy('id')->firstOrFail();
$prescription = App\Models\Prescription::where('patient_id', $patient->id)->latest('issued_on')->firstOrFail();
$drug = App\Models\Drug::where('is_active', true)->orderBy('id')->firstOrFail();
$today = today()->toDateString();
$weekEnd = today()->addDays(6)->toDateString();
$tomorrow = today()->addDay()->toDateString();

$out['ids'] = ['patient' => $patient->id, 'prescription' => $prescription->id, 'drug' => $drug->id, 'today' => $today];
$out['doctor'] = [
    '/me' => $get($doctor, '/me'),
    '/doctor/appointments' => $get($doctor, "/doctor/appointments?from=$today&to=$today"),
    '/doctor/appointments?week' => $get($doctor, "/doctor/appointments?from=$today&to=$weekEnd"),
    '/doctor/patients' => $get($doctor, '/doctor/patients'),
    "/doctor/patients/{$patient->id}" => $get($doctor, "/doctor/patients/{$patient->id}"),
    "/doctor/patients/{$patient->id}/prescriptions" => $get($doctor, "/doctor/patients/{$patient->id}/prescriptions"),
    "/doctor/prescriptions/{$prescription->id}" => $get($doctor, "/doctor/prescriptions/{$prescription->id}"),
    '/doctor/reports/summary?day' => $get($doctor, '/doctor/reports/summary?period=day'),
    '/doctor/reports/summary?week' => $get($doctor, '/doctor/reports/summary?period=week'),
    '/doctor/reports/summary?month' => $get($doctor, '/doctor/reports/summary?period=month'),
    '/doctor/reports/payments' => $get($doctor, '/doctor/reports/payments?from='.today()->startOfMonth()->toDateString()."&to=$today"),
    '/doctor/reports/daily-revenue' => $get($doctor, '/doctor/reports/daily-revenue'),
    '/doctor/reports/outstanding' => $get($doctor, '/doctor/reports/outstanding'),
    '/doctor/settings' => $get($doctor, '/doctor/settings'),
    '/doctor/working-hours' => $get($doctor, '/doctor/working-hours'),
    '/doctor/staff' => $get($doctor, '/doctor/staff'),
    '/doctor/blocked-times' => $get($doctor, '/doctor/blocked-times'),
    '/doctor/drugs' => $get($doctor, '/doctor/drugs'),
    '/doctor/drugs/search' => $get($doctor, '/doctor/drugs/search?q=amo'),
    "/doctor/drugs/{$drug->id}" => $get($doctor, "/doctor/drugs/{$drug->id}"),
    '/doctor/audit-logs' => $get($doctor, '/doctor/audit-logs'),
    '/slots' => $get($doctor, "/slots?date=$tomorrow"),
];
$out['assistant'] = [
    '/me' => $get($assistant, '/me'),
    '/assistant/appointments' => $get($assistant, "/assistant/appointments?from=$today&to=$today"),
    '/assistant/appointments?week' => $get($assistant, "/assistant/appointments?from=$today&to=$weekEnd"),
    '/assistant/patients' => $get($assistant, '/assistant/patients'),
    "/assistant/patients/{$patient->id}" => $get($assistant, "/assistant/patients/{$patient->id}"),
    '/assistant/visits/unpaid' => $get($assistant, '/assistant/visits/unpaid'),
    '/slots' => $get($assistant, "/slots?date=$tomorrow"),
];
$patientUser = $patient->user;
$out['patient'] = [
    '/me' => $get($patientUser, '/me'),
    '/patient/profile' => $get($patientUser, '/patient/profile'),
    '/patient/appointments' => $get($patientUser, '/patient/appointments'),
    '/slots' => $get($patientUser, "/slots?date=$tomorrow"),
];
$out['public'] = ['/health' => ['status' => 'ok', 'time' => now()->toIso8601String()]];

// The full "who owes what" list is thousands of rows; 25 show the page as well.
$out['doctor']['/doctor/reports/outstanding']['data'] = array_slice($out['doctor']['/doctor/reports/outstanding']['data'], 0, 25);
$out['note'] = "Captured {$today} from the PerformanceSeeder dataset (fake people) through the API; the outstanding list is cut to 25 rows. Regenerate with dump-fixtures.php.";

$target = getenv('FIXTURES_OUT');
file_put_contents($target, json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n");
echo 'wrote '.strlen(file_get_contents($target))." bytes, patient {$patient->id}\n";
