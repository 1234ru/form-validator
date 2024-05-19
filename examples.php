<?php

require_once __DIR__ . '/FormValidator.php';

$cases = [
    '1' => 'Простая проверка',
    '2' => 'Проверка регулярным выражением',
    '3' => 'Вторичная функциональная проверка',
    '4' => 'Главная функциональная проверка',
    '5' => 'Главная функциональная проверка вместе с вторичной',
    '6' => 'Общая проверка нескольких полей',
    '7' => 'Набор однородных полей',
    '8' => 'children',
];

switch ($case = ($_GET['case'] ?? 1)) {
    case '1':
        $config = [
            'name' => 'Укажите имя.',
            'phone' => [
                '*' => 'Укажите телефон.'
            ],
            'email' => []
        ];
        $values = [];
    break;

    case '2':
        $config = [
            'phone' => [
                '*' => 'Укажите телефон.',
                '/^\d{10}$/' => 'Телефон следует указывать в виде 10 цифр.',
            ],
            'email' => [
                '/^[\.\-\w]+@(\w+\-)*\.[A-z]{2}$/' => '"{*value*}" не является адресом электронной почты.',
            ]
        ];
        $values = [
            'phone' => '1234',
            'email' => 'somebody@',
        ];
        break;
    case '3':
        $config = [
            'phone' => [
                '*' => 'Укажите телефон.',
                '/^\d{10}$/' => 'Телефон следует указывать в виде 10 цифр.',
                function($value) {
                    return "Телефон $value не значится в наших списках." ;
                }
            ]
        ];
        $values = [
            'phone' => '1234567890',
        ];
        break;
    case '4':
        $config = [
            'phone' => function($value) {
                return "Phone: " . var_export($value, 1);
            }
        ];
        break;
    case '5':
        $config = [
            'phone' => [
                '*' => function($value) {
                    // return "No way with such phone: " . $value;
                },
                function($value) {
                    return "This may run only after the primary check.";
                },
                function($value) {
                    return "This may run only after the primary check too.";
                }
            ]
        ];
        break;
    case '6':
        $config = [
            function($query) {
                if (true) { // тут проверяем телефон и email
                    $errors[] = [
                        'name' => 'email',
                        'value' => $query['email'],
                        'message' => "К телефону $query[phone] привязан другой email."
                    ];
                }
                return $errors ?? [];
            }
        ];
        $values = [
            'phone' => '1234567890',
            'email' => 'someone@somewhere.ru',
        ];
        break;
    case '7':
        $config = [
            'promo_codes' => [
                '*' => 'Нужно ввести хотя бы один промо-код.',
                // '[]' => function($value) {
                //     if ($value AND mb_strlen($value) < 4) {
                //         return "Промо-код $value указан неправильно";
                //     }
                // },
                '[]' => [
                    '/^[A-z]+$/' => 'Промо-коды могут состоять только из латинских букв.',
                    function ($value) {
                        if (mb_strlen($value) < 4) {
                            return "Промо-код $value не распознан.";
                        }
                    }
                ]

            ]
        ];
        $values = [ 'promo_codes' => [] ];
        // $values = [
        //     'promo_codes' => 'Scalar value',
        // ];
        break;
    case '8':
        $children = true;
        $config = [
            'client' => [
                'children' => [
                    'name' => 'Укажите имя.',
                    'phone' => [
                        '*' => 'Укажите телефон.'
                    ],
                    'promo_codes' => [
                        '[]' => function($value) {
                            return "С промо-кодом " . htmlspecialchars($value) . " что-то не так.";
                        }
                    ],
                    '*' => function($query) {
                        $msg = 'С телефоном и именем что-то не так';
                        foreach (['name', 'phone'] as $name) {
                            $errors[] = [
                                'name' => $name,
                                'value' => $query[$name] ?? null,
                                'message' => $msg
                            ];
                        }
                        return $errors;
                    }
                ]
            ]
        ];
        break;
}

function array_filter_recursive($input) {
    $fn = __FUNCTION__;
    foreach ($input as &$value) {
        if (is_array($value)) {
            $value = $fn($value);
        }
    }
    return array_filter($input);
}

if (! ($children ?? false) ) {
    $values = array_filter_recursive($_GET) + ($values ?? []);
} else {
    // $values = $_GET; // null в value немного путает
    $values = [
        'client' => [
            'name' => '',
            'phone' => '',
            'promo_codes' => [ '123', 'ABC' ],
        ]
    ];
}



    // $form = preg_replace(
    //     '/(?<=name=[\'"])(name|phone|email|promo_codes)/',
    //     'client[$0]',
    //     $form
    // );
if ( ! ($children ?? false) ) {
    $form = "<form>"
        . "<input name='name' placeholder='name' value='" . ($values['name'] ?? '') . "'><br>"
        . "<input name='phone' placeholder='phone' value='" . ($values['phone'] ?? '') . "'><br>"
        . "<input name='email' placeholder='email' value='" . ($values['email'] ?? '') . "'><br>"
        . "<input name='promo_codes[]' placeholder='промо-код' value='" .
        ($values['promo_codes'][0] ?? '') . "'>"
        . "<input name='promo_codes[]' placeholder='промо-код' value='" .
        ($values['promo_codes'][1] ?? '') . "'>"
        . "<input name='promo_codes[]' placeholder='промо-код' value='" .
        ($values['promo_codes'][2] ?? '') . "'><br>"
        . (function() use ($cases, $case) {
            $html = '';
            foreach ($cases as $key => $value) {
                $html .= "<label style='display: block'>"
                    . "<input type='radio' name='case' value='$key' "
                    . ($key == $case ? 'checked' : '')
                    . ">"
                    . $value
                    . "</label>";
            }
            return $html;
        })()
        . "<button>OK</button>"
        . "</form>"
        . "<hr>";
    echo $form;
} else {
    echo "HTTP-запрос:<br>=========="
        . print_pre($values, 1)
        . "=========";
}
$obj = new One234ru\FormValidator($config);
$obj->validate($values);
$errors = $obj->errors;
$separator = "\n" . str_repeat("=", 20). "\n\n";

echo "<div style='white-space: pre-wrap; margin-top: 2em; font-family: monospace'>"
    . "Errors:\n" . json_encode($errors, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
    . $separator
    . "Values: " . json_encode($values, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
    . $separator
    . "Config: " . var_export($config, 1)
    . "</div>";

