<?php

require __DIR__ . '/../../FormValidator.php';
$config = [
    // 'name' => 'Укажите имя.',
    // 'phone' => [
    //     '*' => 'Укажите телефон.',
    //     '/^\d{10}$/' => 'Телефон следует указывать в виде 10 цифр.',
    // ],
    'email' => [
        '/@/' => 'Если уж указан e-mail, то он должен быть корректным!',
    ],
    'choice' => 'Нужно что-нибудь выбрать',
    'color' => [
        '*' => 'Укажите цвет (Blue)',
        // Форму первичной проверки в виде функции не используем,
        // т.к. в случае непустого значения она даст полный массив в качестве value,
        // (типа "color": [{value: ["green"], messages: ["..."]}])
        // который, естественно, ни с одним полем не совпадает.
        // function ($value) {
        //     if (!$value) {
        //         return 'Укажите цвет';
        //     } else {
        //         // print_r($value);
        //         return "No";
        //         return (count($value) > 2) ? "Не более двух цветов" : "";
        //     }
        // },
        '[]' => [
            '/blue/i'  => "Можно выбирать только 'blue', а выбрано '{*value*}'.",
        ],
    ],
    'promo_codes' => [
        '*' => 'Нужно ввести хотя бы один промо-код (только латинские ЗАГЛАВНЫЕ буквы)',
        '[]' => [
            '/^[A-Z]+$/' => 'Промо-код "{*value*}" некорректен: допустимы только ЗАГЛАВНЫЕ латинские буквы',
        ],
    ],
    [
        '*' => function($query) {
            // return "Сводная обязательная проверка";
        },
        function ($query) {
            $msg = <<<MSG
            Сводная необязательная проверка
            (срабатывает только когда все остальные проверки пройдены)
            MSG;
            return [
                [
                    'name' => 'email',
                    'message' => $msg,
                ],
                [
                    'name' => 'phone',
                    'message' => $msg
                ]
            ];
        }
    ]
];
$values = $_GET;
$obj = new One234ru\FormValidator($config);
$errors = $obj->validate($values);
// $obj->addError('Какая-то ошибка в телефоне', 'phone');
// $obj->addError('И с email тоже ошибка', 'email');
if (($values['name'] ?? '') == '1') {
    $obj->addError("Просто ошибка (name = 1), rand = " . rand(10, 99));
}
// $obj->addError("И ещё кое-что.");

$errors = $obj->errors;

switch ($_GET['server_action'] ?? 'errors') {
    case 'errors':
        $response = compact('errors');
        break;
    case 'successMessage':
        $response = ['successMessage' => 'Принято в ' . date('H:i:s')];
        break;
    case 'innerHTML':
        $response = ['innerHTML' => '<b>Ваша заявка принята</b>' ];
        break;
    case 'outerHTML':
        $response = ['outerHTML' => '<div class="instead-of-form">Это вместо формы</div>'];
        break;
    default:
        $response = [];
        break;
}

// usleep(500000);
// sleep(2);
header("Cache-control: no cache");
// echo str_repeat("Not a JSON ", 40); exit;
echo json_encode($response, JSON_UNESCAPED_UNICODE);
