<?php

namespace One234ru;

class FormValidator {

    private const CHECK_TYPES = [
        'necessity',
        'children',
        'regexp',
        'other'
    ];

    /** @var = [ self::$errorInstanceDeclaration ] */
    public $errors = [];

    /** @var = [
     *  'name' => 'HTML field name (like 'email', 'phone', 'client[name]', etc.)',
     *  'value' => 'null or field's current value',
     *  'message' => 'Error message',
     *  'messages' => string[], // list of error messages
     * ]
     */
    private $errorInstanceDeclaration;

    /** @var array = [
     *     'fields' => [
     *      'field_name' => array
     *     ],
     *     'common' => [
     *      'primary' => callable[],
     *      'secondary' => callable[]
     *     ]
     * ]
     */
	private $config;

	function __construct($config)
	{
        $this->setConfigTo($config);
	}

    public function setConfigTo($config)
    {
        $this->config = $this::normalizeConfig($config);
    }

    /**
     * @param array $http_query = [
     *     'name' => 'value'
     * ]
     * // Нет, не возвращаем @return = self::$errors
     */
    public function validate($http_query, $clear_errors = true)
    {
        if ($clear_errors) {
            $this->clearErrors();
        }
        $values = self::trimAndFilterHTTPqueryParams($http_query);
        $config = $this->config;
        foreach ( ($config['fields'] ?? []) as $name => $cfg) {
            $value = $values[$name] ?? NULL;
            if ($results = self::getErrorsForAllInstructionsOnValue($cfg, $value)) {
                if (!is_array(current($results))) {
                    // Standard case - plain list of error messages
                    $this->addError($results, $name, $value);
                } else {
                    // Checks of types [] and chlidren - list of arrays like
                    // { "value": ..., "messages": string[] }
                    foreach ($results as $result) {
                        if (isset($result['name'])) {
                            // Chidren: Increasing depth of name
                            $result = self::increaseFieldNameDepth($result, $name);
                        }
                        else {
                            // []: adding [] to name
                            $result['name'] = $name . '[]';
                        }
                        $this->addError(
                            $result['messages'] ?? $result['message'],
                            $result['name'],
                            $result['value']
                        );

                    }
                }
            }
        }
        $e = &$this->errors;
        $e = array_merge(
            $e,
            self::getErrorsFromCommonCallbacks(
                ($config['common']['primary'] ?? []),
                $values
            )
        );
        if (!$e) {
            $e = array_merge(
                $e,
                self::getErrorsFromCommonCallbacks(
                    ($config['common']['secondary'] ?? []),
                    $values
                )
            );
        }
        // return $e;
    }

    public function addError($messages, $name = null, $value = null)
    {
        if (!is_array($messages)) {
            $messages = [ $messages ];
        }
        $error = array_filter(
            compact('name', 'value', 'messages'),
            function ($value) {
                return !is_null($value);
            }
        );
        $this->errors[] = $error;
    }
    
    /**
     * @param array $config
     * @return array {@see $config}
     */
	private static function normalizeConfig($config)
	{
        if (!is_array($config)) {
            // var_export($config);
            echo json_encode(debug_backtrace()); exit;
        }
		foreach ($config as $key => $value) {
            if (!is_numeric($key) AND $key !== '*') {
                $normalized['fields'][$key] = self::normalizeInstruction($value);
            } else {
                foreach ($value as $k => $callback) {
                    $degree = ($k === '*') ? 'primary' : 'secondary';
                    $normalized['common'][$degree][] = $callback;
                }
            }
		}
		return $normalized ?? [];
	}

    private static function normalizeInstruction($instruction)
    {
        $normalized = (is_array($instruction))
            ? $instruction
            : [ '*' => $instruction ];
        if (isset($normalized['[]'])) {
            $fn = __FUNCTION__;
            $normalized['[]'] = self::$fn($normalized['[]']);
        }
        return $normalized;
    }

    /**
     * Trims field values of HTTP query; if value's key is numeric - removes it completely.
     */
    private static function trimAndFilterHTTPqueryParams($value)
    {
        if (is_array($value)) {
            $fn = __FUNCTION__;
            foreach ($value as $key => $v) {
                $v = self::$fn($v);
                if (is_numeric($key)) {
                    if ( (!is_array($v) AND $v === '') OR (is_array($v) AND !$v) ) {
                        continue;
                    }
                }
                $clean[$key] = $v;
            }
            return $clean ?? [];
        } else {
            // Not only trimming values, but automatically convert it to string
            // for strict check against ''.
            return trim(strval($value));
        }
    }

    /**
     * @param array $callbacks = callable[]
     * @param array $http_query
     * @return array {@see run()}
     */
    private static function getErrorsFromCommonCallbacks($callbacks, $http_query)
    {
        $errors = [];
        foreach ($callbacks as $callback) {
            if ($result = $callback($http_query)) {
                if (is_array($result)) {
                    $errors = array_merge($errors, $result);
                } else {
                    $errors[] = [
                        [ 'message' => $result ]
                    ];
                }
                $errors[] =
                    (is_array($result))
                        ? $result
                        : [ 'message' => $result ]
                ;
            }
        }
        return $errors;
    }

    /**
	 * @param string $field_name // 'a[b][c][x]'
	 * @return string[] // [ 'a', 'b', 'c', 'x' ].
	 */
	private static function splitFieldNameToKeys($field_name)
	{
		$keys = [];
		// Getting the very first key
		preg_match('/^[\*\w]+/', $field_name, $match);
		$keys[] = $match[0];
		// Getting the rest of the keys - those in brackets
		preg_match_all(
			'/\[ (?<subkeys> [\*\w]+ ) \]/x',
			$field_name,
			$matches,
			PREG_PATTERN_ORDER
		);
		$keys = array_merge($keys, ($matches['subkeys'] ?? []) );
		return $keys;
	}

	/**
	 * @param array $keys // [ 'a', 'b', 'c' ]
	 * @return string // a[b][c]
	 */
	private static function mergeKeysIntoFieldName($keys)
	{
		$field_name = $keys[0];
		foreach (array_slice($keys, 1) as $key) {
            $field_name .= "[$key]";
        }
        return $field_name;
	}

    private static function getErrorsForAllInstructionsOnValue($instructions, $value) {
        // Split instructions into groups:
        //  - presence check (*)
        //  - children
        //  - regular expression
        //  - other
        // Run checks of each group only if checks for previous group
        // didn't find any errors.
        // If the value is empty or absent - don't run groups except
        // necessity and children.
        $groups = self::splitInstructionsIntoGroups($instructions);
        foreach (self::CHECK_TYPES as $type) {
            if ( ! ($group = $groups[$type] ?? []) ) {
                continue;
            }
            if ($value === '' AND !in_array($type, ['necessity', 'children'])) {
                continue;
            }
            if ($errors = self::getErrorsForInstructionsGroupOnValue($group, $value)) {
                return $errors;
            }
        }
        return [];
    }

    /**
     * @param array $instructions = [ 'type' => mixed ]
     * @return array = [ 'necessity|children|regexp|other' => array ]
     */
    private static function splitInstructionsIntoGroups($instructions) {
        foreach ($instructions as $key => $instruction) {
            if ($key === '*') {
                $group_name = 'necessity';
            } elseif ($key === 'children') {
                $group_name = $key;
                // === instead of == is very important here,
                // because 0 == 'children' is true,
                // while 0 === 'children' is obviously false
            } elseif (self::isRegexp($key)) {
                $group_name = 'regexp';
            } else {
                $group_name = 'other';
            }
            // Keeping key, passing it into the group;
            // it will be used when actual checks run.
            $groups[$group_name][$key] = $instruction;
        }
        return $groups ?? [];
    }

    private static function isRegexp($instruction) {
        return preg_match('"^/.+/\w*$"', $instruction);
    }

    /**
     * @param mixed $instructions
     * @param mixed $value
     * @return null|false|string[]|array = [
     *     'value' => mixed,
     *     'messages' => string[]
     * ]
     */
    private static function getErrorsForInstructionsGroupOnValue($instructions, $value)
    {
        $errors = [];
        foreach ($instructions as $key => $item) {
            if ($key === '[]') {
                if (is_array($value)) {
                    $result = [];
                    foreach ($value as $v) {
                        $msg = self::getErrorsForAllInstructionsOnValue($item, $v);
                        if ($msg) {
                            $result[] = [
                                'value' => $v,
                                'messages' => $msg
                            ];
                        }
                    }
                } else {
                    // Incorrect case when scalar value is obtained for nested check.
                    $result = "Scalar value instead of array obtained.";
                }
            } elseif ($key === 'children') {
                $children_cfg = $item;
                $children_values = $value;
                $obj = new self($children_cfg);
                $result = $obj->validate($children_values);
            } else {
                if (is_callable($item)) {
                    $result = $item($value);
                } else {
                    $check_type = $key;
                    $message_template = $item;
                    $result = self::getErrorForNonCallbackCheckOfValue(
                        $value,
                        $check_type,
                        $message_template
                    );
                }
            }
            if (!$result) {
                continue;
            }
            if (!is_array($result)) {
                $result = [ $result ];
            }
            $errors = array_merge($errors, $result);
        }
        return $errors;
    }

    /**
	 * @param mixed $value
	 * @param string|callable $check_type
	 * @param string|mixed $instructions // {*value*} is substituted
	 * @return string[]|string|bool // empty if valid
	 */
	private static function getErrorForNonCallbackCheckOfValue(
        $value,
        $check_type,
        $instructions
    ) {
        if ($check_type === '*') {
            $invalid = (
                !is_array($value) and (strval($value) === '')
                // or empty($value)
            );
        } elseif (self::isRegexp($check_type)) {
            $invalid = ! preg_match($check_type, $value);
        } else {
            $msg = "Unknown validation type '$check_type'.";
            trigger_error(
                $msg . print_r(debug_backtrace(), 1),
                E_USER_WARNING
            );
            return $msg;
        }
        $error_message_template = $instructions;
        if ($invalid) {
            return (!is_array($value))
                ? str_replace(
                    '{*value*}',
                    htmlspecialchars((string) $value), // PHP 8.2
                    $error_message_template
                  )
                : $error_message_template;
        } else {
            return FALSE;
        }
	}

    /**
     * @param $error = self::$errorInstanceDeclaration
     * @param string $top_key
     */
    private static function increaseFieldNameDepth($error, $top_key)
    {
        $error['name'] = self::addParentKeyToFieldName($error['name'], $top_key);
        return $error;
    }

    private static function addParentKeyToFieldName($name, $parent_key) {
        return preg_replace(
            '/^\w+/',
            $parent_key . '[$0]',
            $name
        );
    }

    private function clearErrors()
    {
        $this->errors = [];
    }

    public function isFieldValid(string $name) :bool
    {
        return !in_array($name, array_column($this->errors, 'name'));
    }
}
