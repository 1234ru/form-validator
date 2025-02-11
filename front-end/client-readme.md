# Обработчик отправки HTML-форм

Данный инструмент предназначен для отправки данных формы по AJAX и обработки ответа сервера.
Он предоставляет следующие возможности:

* визуальное отображение информации о низкоуровневых сбоях (проблемы с сетью, 
  ответы с HTTP-кодами `4xx` и `5xx`, некорректный JSON)
* размещение информации о результатах проверки формы на сервере, в т.ч. стилизация полей формы через класс `.invalid` (настраивается)
* замена содержимого формы данными ответа сервера
* запуск произвольных функций при получении ответа

Для работы инструмента требуется библиотека jQuery.

Пример: [HTML и javascript](example/test.html), [CSS](example/style.css).

Код для подключения выглядит примерно так:

```html
<form></form>
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="lib.js"></script>
<script>
    var settings = {};  
    var form = $('form');
    new Freedom.FormsValidator(form, settings);
</script>
```

В `settings.url` или `action` формы нужно указать путь для отправки AJAX-запроса, в `settings.method` или атрибуте `method` формы - `'GET'` или `'POST'`,
в противном случае — GET.

Ответ сервера должен представлять собой JSON и может содержать следующие ключи:

* `errors` — информация о полях, не прошедших проверку; генерируется с помощью инструмента 
  для проверки, входящего в состав данного пакета и описанного в
  [в основном README](../README.md)  (подробности — ниже)

Остальные ключи действуют только при пустом `errors` или его отсутствии:

* `successMessage` — текст для отображения под кнопкой отправки (`<input>` или `<button>` с 
  `type="submit"`)
* `innerHTML` — HTML-код, который заменит содержимое тега `<form>` на странице
* `outerHTML` — HTML-код, который будет вставлен вместо тега `<form>`

```php 
$config = [...]; // Конфигурация проверки полей
$obj = new \Freedom\Forms\Validator($config);
$errors = $obj->getErrors($_GET); // или $_POST
if ($errors) {
   $response = compact('errors');
} else {
   // Здесь генерируются $successMessage, $innerHTML или $outerHTML,
   // а также происходят прочие действия, ради которых была отправлена форма.
   ...
   $response = [ 'successMessage' => '...' ],
}
header("Content-type: application/json");
echo json_encode($response);
```

Примеры кода клиентской и серверной части находятся в файлах 
[example/test.html](example/test.html) и 
[example/form-ajax.php](example/form-ajax.php)
соответственно.

Не рекомендуется использовать `<input type="email">`, поскольку для таких полей станут работать [встроенные проверки браузера](https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation). Вместо них следует использовать `<input type="text">`. (О том, почему встроенные проверки наряду с псевдоклассом `:invalid` невозможно толково использовать, см. [здесь](why-no-native-validation.md).)

Ниже следует полное описание особенностей работы клиентской части и всех её настроек.


## Размещение информации о полях формы, не прошедших проверку на сервере (ключ ответа `errors`)

Гибкое отображение результатов проверки HTML-формы на сервере — это основная часть данного 
инструмента, ради которой он и задумывался.

Такая проверка нужна практически для любой формы: почти всегда есть хоть какие-то условия 
на содержимое полей.

Проверка нужна именно — *и только* — на стороне сервера по ряду причин:
* запрос можно послать в обход формы
* некоторые проверки в принципе возможны только на сервере (например, такие, для 
которых требуется обращение к базе данных)
* это удобно с точки зрения расположения всей логики проверок в одном месте

Структура результатов проверки позволяет *отнести каждое сообщение к тому или иному полю*, 
группе полей или всей форме в целом, если ошибка носит общий характер, *и отобразить её 
рядом с полем, а также, при желании, изменить стиль самого поля*.



### `errorBlock`, `scrollDuration`

Каждому полю может соответствовать одно или несколько сообщений об ошибках в формате HTML.
Эти сообщения объединяются через теги `<br>`, и результат, обёрнутый в
специальный тег (см. `errorBlock` ниже), вставляется в форму сразу после
поля или после родительского для поля тега `<label>`, если он есть. 

Определение места для вставки также можно настроить с помощью `findErrorsBlock` и `insertErrorsBlock`.

Общие для всей формы сообщения вставляются в конец формы.

Обёрткой по умолчанию служит тег `<div>` с классом `error`, наличие которого позволяет
задавать стиль блока сообщений.

Оба эти параметра можно настроить:

```javascript
var settings = {
    errorBlock: {
      className: 'error-custom',
      openingTagTemplate: '<span style="...">', // тегу можно указывать атрибуты
    }
}
```

При этом *окно плавно прокручивается к первому из полей, у которого есть ошибки, если это поле находится вне видимой области*. Настройка **`scrollDuration`**, указанная в миллисекундах, позволяет задать длительность анимации.


### `invalidFieldClassName`

Каждому из полей, для которых в ответе есть ошибки, назначается класс `invalid`. Это можно 
использовать для стилизации (например, сделать полю красную рамку). С помощью настройки `invalidFieldClassName` можно поменять его имя или вовсе отменить назначение, указав пустую строку или `false`. 


## Ошибки, вызванные сбоями

Сюда относятся ошибки HTTP-запроса (код ответа, не равный 200) и ошибки разбора JSON.

Все они обрабатываются механизмом автоматически, информация о них выводится в общем блоке сообщений. Длина регулируется настройкой `rawResponseChunkLength` (по умолчанию - 64 Кб).


## Прочие настройки

* `beforeSubmit` - действия перед отправкой формы (аргумент - `form`)

* `submitButton` - преобразования кнопки отправки
  * `selector` (по умолчанию - `button[type=submit]`  
  * `textOnSubmit` - текст кнопки при отправке запроса (до получения ответа), строка или функция объекта кнопки; по умолчанию также распознается data-атрибут `text_on_submit`

* `insertErrorsBlock(field, errorsBlock, isForFieldGroup)`
  Вставка блока с сообщениями об ошибках для данного поля.
  `isForFieldGroup` - ошибки для группы однотипных полей, радиокнопок или множественных чекбоксов.
  Работает в связке с `findErrorsBlock`.

* `findErrorsBlock(field, isForFieldGroup)`
  Поиск блока с сообщениями об ошибках для данного поля.
  Возвращает jQuery-объект блока или jQuery-коллекцию нулевой длины.
  Работает в связке с `insertErrorsBlock`.

* `commonMessagesBlock` - декларация расположения общего блока сообщений (как правило, над или под кнопкой отправки), объект из двух функций:
  * `locate: function (form, submitButton)` - операция поиска блока
  * `insert: function (block, form, submitButton)` - операция вставки блока
  Определять декларацию, как правило, нужно при нестандартной структуре формы (например, если её элементы находятся распределены по таблице)

* `onResponseCallback` - действия при получении ответа
  Аргументы - `form` и `response`.
  
* `onEmptyErrors` - действия при отсутствии в ответе `errors` и `outerHTML`
  А) анимация: `fadeOut|hide|slideUp`
  Б) `function(form, response)`

* `successBlock` - шаблон-обёртка для `successMessage`, аналогично `errorBlock`

* `scrollDuration` - период прокрутки формы (при необходимости)

* `scrollOffset` - сдвиг положения прокрутки по вертикали вниз 
  от целое число или `function(form)`, вызываемая при каждой операции прокрутки