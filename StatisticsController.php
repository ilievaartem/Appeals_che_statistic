<?php namespace Backend\Controllers;

use Backend\Classes\Controller;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Carbon\Carbon;

class StatisticsController extends Controller
{
    protected $departmentNames = [
        'apparat' => 'Апарат',
        'dep-region' => 'Департамент регіонального розвитку',
        'dep-commun' => 'Департамент комунікацій',
        'dep-build' => 'Департамент капітального будівництва',
        'dep-life' => 'Департамент систем життєзабезпечення',
        'dep-social' => 'Департамент соціального захисту населення',
        'dep-health' => 'Департамент охорони здоров\'я',
        'dep-fin' => 'Департамент фінансів',
        'dep-safety' => 'Департамент оборонної роботи',
        'dep-edu' => 'Департамент освіти і науки',
        'state-arch' => 'Державний архів Чернівецької області',
        'child-service' => 'Служба у справах дітей',
        'dep-eco' => 'Управління екології та природних ресурсів',
        'dep-agro' => 'Управління агропромислового розвитку',
        'dep-culture' => 'Управління культури',
        'dep-digital' => 'Управління цифрового розвитку, цифрових трансформацій і цифровізації',
        'dep-vet' => 'Управління з питань ветеранської політики',
        'dep-population' => 'Управління цивільного захисту населення',
        'dep-sport' => 'Управління молоді та спорту',
        'legal-management' => 'Юридичне управління',
    ];

    public function data()
    {
        $cacheKey = 'appeals_statistics_v1';
        $statistics = Cache::remember($cacheKey, 60, function () {
            return $this->buildStatistics();
        });

        $from = request()->query('from');
        $to = request()->query('to');
        $department = request()->query('department');
        $type = request()->query('type'); 

        $filtered = array_filter($statistics['records'], function ($row) use ($from, $to, $department, $type) {
            if ($from && $row['date'] < $from) return false;
            if ($to && $row['date'] > $to) return false;
            if ($department && $row['department_key'] !== $department) return false;
            if ($type && $row['type'] !== $type) return false;
            return true;
        });

        $deptAgg = [];
        $timeline = [];
        $totalElectronic = 0; $totalWritten = 0; $total = 0;
        foreach ($filtered as $row) {
            $dKey = $row['department_key'];
            if (!isset($deptAgg[$dKey])) {
                $deptAgg[$dKey] = [
                    'department_key' => $dKey,
                    'department' => $this->departmentNames[$dKey] ?? $row['department'],
                    'electronic' => 0,
                    'written' => 0,
                    'total' => 0
                ];
            }
            if ($row['type'] === 'electronic') { $deptAgg[$dKey]['electronic']++; $totalElectronic++; }
            else { $deptAgg[$dKey]['written']++; $totalWritten++; }
            $deptAgg[$dKey]['total']++;
            $total++;

            $day = $row['date'];
            if (!isset($timeline[$day])) {
                $timeline[$day] = ['date' => $day, 'electronic' => 0, 'written' => 0, 'total' => 0];
            }
            if ($row['type'] === 'electronic') $timeline[$day]['electronic']++; else $timeline[$day]['written']++;
            $timeline[$day]['total']++;
        }

        foreach ($deptAgg as &$d) {
            $d['percent'] = $total ? round($d['total'] / $total * 100, 2) : 0;
        }
        unset($d);

        return response()->json([
            'success' => true,
            'summary' => [
                'total' => $total,
                'electronic' => $totalElectronic,
                'written' => $totalWritten,
                'from' => $from,
                'to' => $to
            ],
            'departments' => array_values($deptAgg),
            'timeline' => array_values($timeline),
            'records' => array_values($filtered)
        ]);
    }

    private function buildStatistics(): array
    {
        $records = [];

        $electronicRoot = storage_path('app/diia_signed');
        if (File::exists($electronicRoot)) {
            foreach (File::directories($electronicRoot) as $recipientDir) {
                $recipientKey = basename($recipientDir);
                foreach (File::directories($recipientDir) as $dateDir) {
                    $date = basename($dateDir);
                    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) continue;
                    foreach (File::directories($dateDir) as $requestFolder) {
                        $userData = $requestFolder . '/user_data.json';
                        $textFiles = File::files($requestFolder);
                        $payload = [];
                        if (File::exists($userData)) {
                            $payload = json_decode(File::get($userData), true) ?: [];
                        }
                        $records[] = [
                            'id' => basename($requestFolder),
                            'department_key' => $recipientKey,
                            'department' => $this->departmentNames[$recipientKey] ?? $recipientKey,
                            'date' => $date,
                            'type' => 'electronic',
                            'payload' => $payload,
                        ];
                    }
                }
            }
        }

        $writtenRoot = storage_path('app/submit_appeal');
        if (File::exists($writtenRoot)) {
            foreach (File::directories($writtenRoot) as $recipientDir) {
                $recipientKey = basename($recipientDir);
                foreach (File::directories($recipientDir) as $dateDir) {
                    $dateRaw = basename($dateDir);
                    if (!preg_match('/^\d{8}$/', $dateRaw)) continue;
                    $date = Carbon::createFromFormat('Ymd', $dateRaw)->format('Y-m-d');
                    foreach (File::directories($dateDir) as $submitFolder) {
                        $formData = $submitFolder . '/form_data.json';
                        $payload = [];
                        if (File::exists($formData)) {
                            $payload = json_decode(File::get($formData), true) ?: [];
                        }
                        $records[] = [
                            'id' => basename($submitFolder),
                            'department_key' => $recipientKey,
                            'department' => $this->departmentNames[$recipientKey] ?? $recipientKey,
                            'date' => $date,
                            'type' => 'written',
                            'payload' => $payload,
                        ];
                    }
                }
            }
        }

        return [ 'records' => $records ];
    }
}
