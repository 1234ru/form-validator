var Freedom = Freedom || {};

/**
 * @constructor
 * @param {jQuery} form
 * @param {FormsValidator~Options} options
 */
Freedom.FormsValidator = function (form, options) {
    this.form = form;
    /** @var {FormsValidator~Options} */
    this.settings = {};
    $.extend(true, this.settings, this.defaults, options);
    this.ajaxRequestURL = this.settings.url || this.form.attr('action');
    this.fields = this.getInputs(this.form);
    this.submitButton = this.locateSubmitButton();
    this.submitButtonOriginalHTML = '';
    this.fieldsWithErrors = [];
    this.scrollPositionToBe = null;
    /** @var {int[]} */
    this.attendedErrorsIndexes = [];
    this.commonErrors = [];
    this.HTTPerrorData = undefined;
    this.JSONsyntaxErrorData = undefined;
    var obj = this;
    this.form.submit(function (event) {
        obj.submitHandler(event);
    });
    // this.form.get(0).novalidate = true; // no use: doesn't prevent
    // bubbling error messages on form submitting tries
};

/**
 * @typedef {object} FormsValidator~Options
 * @property {string=} invalidFieldClassName
 * @property {string=} url
 * @property {string=} method
 * @property {number=} scrollDuration
 * @property {void|number|FormsValidator~scrollOffsetCallback} scrollOffset
 * @property {FormsValidator~ErrorBlock|void} errorBlock
 * @property {FormsValidator~insertFieldErrorBlock|void} insertFieldErrorBlock
 * @property {FormsValidator~findFieldErrorBlock|void} findFieldErrorBlock
 * @property {FormsValidator~successBlock|void} successBlock
 * @property {FormsValidator~SubmitButton|void} submitButton
 * @property {FormsValidator~commonMessagesBlock} commonMessagesBlock
 * @property {FormsValidator~beforeSubmitCallback} beforeSubmit
 * @property {FormsValidator~onResponseCallback} onResponseCallback
 * // doesn't work this way: @property{FormsValidator~onEmptyErrorsAnimation|FormsValidator~onEmptyErrorsCallback|void} onEmptyErrors
 * @property {FormsValidator~onEmptyErrorsAction|void} onEmptyErrors
 * @oroperty {bool|void} disableBrowserBuiltInValidation
 */

/**
 * @typedef {object} FormsValidator~ErrorBlock
 * @property {string=} className
 * @property {string=} openingTagTemplate
 */

/**
 * @typedef {object} FormsValidator~successBlock
 * @property {string=} className
 * @property {string=} openingTagTemplate
 */

/**
 * @callback {FormsValidator~insertFieldErrorBlock}
 * @param {jQuery} field
 * @param {jQuery} errorBlock
 * @param {bool|void} isForFieldGroup
 * @param {FormsValidator} validatorObject
 */

/**
 * @callback {FormsValidator~findFieldErrorBlock}
 * @param {jQuery} field
 * @param {bool|void} isForFieldGroup
 * @param {FormsValidator} validatorObject
 * @return {jQuery}
 */

/**
 * @typedef {object} FormsValidator~SubmitButton
 * @property {string=} selector
 * @property {string|FormsValidator~buttonTextOnSubmitCallback} buttonTextOnSubmit
 * @return void
 */

/**
 * @callback FormsValidator~buttonTextOnSubmitCallback
 * @param {jQuery} button
 */

/**
 * @callback FormsValidator~beforeSubmitCallback
 * @param [jQuery} form
 */

/**
 * @typedef {object} FormsValidator~ErrorData
 * @property {string[]} messages
 * @property {string|void} name
 * @property {string|number|void} value
 */

/**
 * @typedef {object} FormsValidator~ErrorsForValue
 * @property {string|null|void} value
 * @property {string[]} messages
 */

/**
 * @typedef FormsValidator~onEmptyErrorsAction
 * @property {FormsValidator~onEmptyErrorsAnimaion} animation
 */

/**
 * @typedef FormsValidator~onEmptyErrorsAnimaion
 * @property {string} type
 * @property {int|void} duration
 * @property {int|void} delay
 */

/**
 * @callback FormsValidator~onResponseCallback
 * @param {jQuery} form
 * @param {FormsValidator~ajaxResponse} response
 */

/**
 * @callback FormsValidator~onEmptyErrorsCallback
 * @param {jQuery} form
 * @param {FormsValidator~ajaxResponse} response
 */

/**
 * @typedef FormsValidator~ajaxResponse
 * @poperty {FormsValidator~ErrorData[]} errors
 * @poperty {string|void} successMessage
 * @poperty {string|void} outerHTML
 * @poperty {string|void} innerrHTML
 */

/**
 * @typedef FormsValidator~commonMessagesBlock
 * @property {FormsValidator~commonMessagesBlockLocate} locate
 * @property {FormsValidator~commonMessagesBlockInsert} insert
 */

/**
 * @callback FormsValidator~commonMessagesBlockLocate
 * @param {jQuery} form
 * @param {jQuery} submitButton
 */

/**
 * @callback FormsValidator~commonMessagesBlockInsert
 * @param {jQuery} block
 * @param {jQuery} form
 * @param {jQuery} submitButton
 */

/**
 * @callback FormsValidator~scrollOffsetCallback
 * @param {jQuery} form
 */

/** @type {FormsValidator~Options} */
Freedom.FormsValidator.prototype.defaults = {
    invalidFieldClassName: 'invalid',
    scrollDuration: 200,
    scrollOffset: 0,
    rawResponseChunkLength: 100 * 1024,
    errorBlock: {
        className: 'error',
        openingTagTemplate: '<div>',
    },
    successBlock: {
        className: 'success',
        openingTagTemplate: '<div>',
    },
    submitButton: {
        selector: 'button[type=submit]',
        buttonTextOnSubmit: function(button) {
            return button.data('text_on_submit');
            // return false to disable
        }
    },
    commonMessagesBlock: {
        locate: function (form, submitButton) {
            return submitButton
                ? submitButton.parent().nextAll()
                : undefined;
        },
        insert: function (block, form, submitButton) {
            return form.append(block);
        }
    },
    disableBrowserBuiltInValidation: true,
};

Freedom.FormsValidator.prototype.submitHandler = function (event) {
    event.preventDefault();
    var obj = this;
    if (typeof this.settings.beforeSubmit === 'function') {
        this.settings.beforeSubmit(this.form);
    }
    this.disableSubmitButton();
    this.scrollPositionToBe = null;
    $.ajax({
        url: this.ajaxRequestURL,
        method: this.settings.method || this.form.attr('method'),
        data: this.form.serialize(),
        // dataType: 'json', //
        dataFilter: function (responseString) {
            try {
                obj.JSONsyntaxErrorData = undefined;
                return JSON.parse(responseString);
            } catch (e) {
                obj.JSONsyntaxErrorData = e;
                return responseString;
            }
        }
    }).fail(function (request) {
        obj.HTTPerrorData = request;
    }).done(function (request) {
        obj.HTTPerrorData = undefined;
    }).always(function (request) {
        obj.handleResponse(request);
        obj.enableSubmitButton();
    });
};

/**
 * @param {FormsValidator~ajaxResponse} response
 */
Freedom.FormsValidator.prototype.handleResponse = function (response) {

    var commonErrors = [];
    this.attendedErrorsIndexes = [];
    if (this.HTTPerrorData) {
        commonErrors.push(this.HTTPerrorMessage(response));
    } else if (this.JSONsyntaxErrorData) { // see jQuery.ajax.dataFilter
        commonErrors.push(this.JSONsyntaxErrorMessage(this.JSONsyntaxErrorData, response));
    } else if (response.outerHTML) {
        this.form.replaceWith(response.outerHTML);
    } else {
        if (response.innerHTML) {
            this.form.html(response.innerHTML);
            this.fields = this.getInputs(this.form);
        }
        this.fieldsWithErrors = [];
        this.scrollPositionToBe = null;
        var errorsGrouped = this.groupErrorsByNameAndValue(response.errors || []);
        var obj = this;
        this.fields.each(function () {
            obj.applyResponseToField($(this), errorsGrouped);
        });
        // commonErrors = this.extractCommonErrorsFromGrouped(errorsGrouped);
        commonErrors = this.getUnattendedErrorMessagesFromResponse
            (response.errors || []);
        // console.dir(commonErrors);
    }

    this.setCommonErrors(commonErrors);
    this.scrollToFirstErrorIfNecessary();
    this.setSuccessMessage(response.successMessage || '');

    if (typeof this.settings.onResponseCallback === 'function') {
        this.settings.onResponseCallback(this.form, response);
    }

    if (
        !commonErrors.length
        && !(response.errors || []).length
        && !response.outerHTML
    ) {
        this.applyOnEmptyErrorsAction(this.form, response);
    }

}

/**
 * @param {XMLHttpRequest} request
 * @return string
 * */
Freedom.FormsValidator.prototype.HTTPerrorMessage = function(request) {
    // request.responseURL is empty if HTTP error occured
    // Let's leave it technical for a while
    var message = 'HTTP error: ';
    if (request.status === 0) {
        message += "can't connect (code = 0)";
    } else {
        message += request.status + ' ' + request.statusText;
    }
    message += "<br>URL: " + this.ajaxRequestURL;
    return message;
}

/**
 * @param {SyntaxError} syntaxError
 * @param {string} response
 */
Freedom.FormsValidator.prototype.JSONsyntaxErrorMessage = function(
    syntaxError,
    response
) {
    var max = this.settings.rawResponseChunkLength;
    var cut = response.length > max;
    var message = syntaxError.message + ':<hr>'
        + '<code>' + response.substr(0, max);
    if (cut) {
        message += ' (...)';
    }
    message += '</code><hr>'
    if (cut) {
        message += `(first ${max} symbols of ${response.length} total)`;
    }
    return message;
    // console.dir(syntaxError);
    // console.dir(response);
}

/**
 * @param {jQuery} form
 * @return jQuery[]
 */
Freedom.FormsValidator.prototype.getInputs = function(form) {
    return form.find('input, select, textarea');
}

/**
 * @param {jQuery} field
 * @param {object} errorsGrouped
 */
Freedom.FormsValidator.prototype.applyResponseToField = function(field, errorsGrouped) {
    var fieldName = field.attr('name');
    var fieldType = field.attr('type');
    var isMultipleCheckbox = (fieldType == 'checkbox' && fieldName.substr(-2) == '[]');
    var isRadioOrMultipleCheckbox = (fieldType == 'radio' || isMultipleCheckbox);

    // 1. Searching by field's value
    var groupOfValue = this.findErrorsGroupByNameAndValue(
        errorsGrouped,
        fieldName,
        field.val(),
        isRadioOrMultipleCheckbox
    );
    var messages = groupOfValue ? groupOfValue.messages : [];


    // 2. Searching errors without explicit value
    var groupOfNoValue = this.findErrorsGroupByNameAndValue(errorsGrouped, fieldName);

    // A) Radiobuttons and multiple checkboxes:
    //    if the field is first of a kind,
    //    inserting COMMON messages for a group PRIOR to it
    // B) The rest of the fields: just adding messages to the existing list
    if (isRadioOrMultipleCheckbox) {
        if (this.fields.filter('[name="' + fieldName + '"]').index(field) === 0) {
            var groupOfNoValue = this.findErrorsGroupByNameAndValue(
                errorsGrouped,
                (!isMultipleCheckbox) ? fieldName : fieldName.slice(0, -2)
            );
            this.setErrorMessagesAndScrollPositionToBe(
                field,
                groupOfNoValue ? groupOfNoValue.messages : [],
                true
            );
        }
    } else {
        var groupOfNoValue = this.findErrorsGroupByNameAndValue(errorsGrouped, fieldName);
        messages = messages.concat(groupOfNoValue ? groupOfNoValue.messages : []);
    }
    this.setErrorMessagesAndScrollPositionToBe(field, messages);
}

/** @param {string[]} messages */
Freedom.FormsValidator.prototype.makeErrorBlockContents = function(messages) {
    return (messages) ? messages.join('<br>') : '';
}

/**
 * @param {jQuery} field
 * @param {string[]} messages
 * @param {boolean=false} isForFieldsGroup
 */
Freedom.FormsValidator.prototype.setErrorMessagesAndScrollPositionToBe = function (
    field,
    messages,
    isForFieldsGroup
) {
    // Not gonna work, `this` is `Window` when used in such way
    // var errorBlock = (
    //     this.settings.findFieldErrorBlock
    //     ||
    //     this.findFieldErrorBlock
    // )(field, isForFieldsGroup, this);
    var fnFind = this.settings.findFieldErrorBlock;
    var fnInsert = this.settings.insertFieldErrorBlock;
    var invalidFieldClassName = this.settings.invalidFieldClassName;
    var errorBlock = (typeof fnFind === 'function')
        ? fnFind(field, isForFieldsGroup, this)
        : this.findFieldErrorBlock(field, isForFieldsGroup);

    if (messages.length) {
        if (!errorBlock.length) {
            errorBlock = this.createErrorBlock();
            if (typeof fnInsert === 'function') {
                fnInsert(field, errorBlock, isForFieldsGroup, this);
            } else {
                this.insertFieldErrorBlock(field, errorBlock, isForFieldsGroup);
            }
        }
        errorBlock.html( this.makeErrorBlockContents(messages) );
        if (invalidFieldClassName) {
            field.addClass(invalidFieldClassName);
        }

        this.refreshScrollPositionToBe(
            !isForFieldsGroup
            ? this.whatToScrollToOnError(field, errorBlock)
            : errorBlock
        );
    } else {
        if (errorBlock.length) {
            errorBlock.remove();
            if (invalidFieldClassName) {
                field.removeClass(invalidFieldClassName);
            }
        }
    }
}

Freedom.FormsValidator.prototype.createErrorBlock = function () {
    return $(this.settings.errorBlock.openingTagTemplate)
        .addClass(this.settings.errorBlock.className);
}

/** @type {FormsValidator~insertFieldErrorBlock} */
Freedom.FormsValidator.prototype.insertFieldErrorBlock = function(
    field,
    errorBlock,
    isForFieldsGroup
) {
    var label = field.closest('label');
    var isLabeled = label.length > 0;
    var blockToPositionErrorRelavelyTo = (isLabeled) ? label : field;
    var fn = (isForFieldsGroup) ? 'before' : 'after';
    return blockToPositionErrorRelavelyTo[fn](errorBlock)
}

/** @type {FormsValidator~findFieldErrorBlock} */
Freedom.FormsValidator.prototype.findFieldErrorBlock = function(
    field,
    isForFieldsGroup
) {
    var label = field.closest('label');
    var isLabeled = label.length > 0;
    var blockToPositionErrorRelavelyTo = (isLabeled) ? label : field;
    var selector = '.' + this.settings.errorBlock.className;
    var fn = (isForFieldsGroup) ? 'prev' : 'next';
    return blockToPositionErrorRelavelyTo[fn](selector);
}

/**
 * @param {jQuery} element
 * @return void
 * */
Freedom.FormsValidator.prototype.refreshScrollPositionToBe = function (element) {
    var offset = element.offset().top;
    this.scrollPositionToBe = (this.scrollPositionToBe !== null)
        ? Math.min(offset, this.scrollPositionToBe)
        : offset;
}

Freedom.FormsValidator.prototype.whatToScrollToOnError = function(
    field,
    errorBlock
) {
    var label = field.closest('label');
    if (label.length > 0) {
        return label;
    } else {
        return (field.is(':visible'))
            ? field
            : errorBlock;
    }
}

Freedom.FormsValidator.prototype.scrollToFirstErrorIfNecessary = function () {
    if (this.scrollPositionToBe === null) {
        return ;
    }
    var scrollPos = this.scrollPositionToBe;
    var tmp = this.settings.scrollOffset;
    var scrollOffset = (typeof tmp === 'function')
        ? tmp(this.form)
        : tmp;
    scrollOffset = parseInt(scrollOffset);
    if (this.isPositionOutsideOfView(scrollPos, scrollOffset)) {
        scrollPos -= scrollOffset;
        $('html, body').animate(
            { scrollTop: scrollPos },
            this.settings.scrollDuration
        );
    }
}

/**
 * @param {number} position
 * @param {number} minimalGapAtTop
 * @return {boolean}
 */
Freedom.FormsValidator.prototype.isPositionOutsideOfView = function(position, minimalGapAtTop) {
    minimalGapAtTop = minimalGapAtTop || 0;
    var viewportHeight = document.children[0].clientHeight; // <html>
    return (
        position - minimalGapAtTop < window.scrollY
        ||
        position // - minimalGapAtBottom
        >
        window.scrollY + viewportHeight
    );
    // return (
    //     position < window.scrollY
    //     ||
    //     position - (minimalGapAtBottom || 0) > window.scrollY + window.innerHeight
    // );
}

Freedom.FormsValidator.prototype.locateSubmitButton = function () {
    var sbs = this.settings.submitButton;
    if (sbs) {
        var selector = (typeof sbs === 'string') ? sbs : sbs.selector;
        var button = this.form.find(selector);
        return (button.length) ? button : undefined;
    }
}

Freedom.FormsValidator.prototype.disableSubmitButton = function () {
    if (!this.submitButton) {
        return ;
    }
    this.submitButton.attr('disabled', true);
    var html = this.getButtonTextOnSubmit();
    if (html || html === '') {
        var button = this.submitButton;
        this.submitButtonOriginalHTML = button.html();
        button.html(html);
    }
}

Freedom.FormsValidator.prototype.getButtonTextOnSubmit = function () {
    if (typeof this.settings.submitButton === 'object') {
        var txt = this.settings.submitButton.buttonTextOnSubmit;
        return (typeof txt === 'string')
            ? txt
            : txt(this.submitButton);
    } else {
        return false;
    }
}

Freedom.FormsValidator.prototype.enableSubmitButton = function () {
    var button = this.submitButton;
    if (!button) {
        return ;
    }
    button.attr('disabled', false);
    var html = this.submitButtonOriginalHTML;
    if (html) {
        button.html(html);
    }
}

/**
 * @param {FormsValidator~ErrorData[]} errorItems
 * @return {object}
 * Returns an object which has field names in keys
 * and an array of groups of errors in values - (see FormsValidator~ErrorsForValue).
 * {
 *     "phone": {
 *          [
 *              value: "123",
 *              messages: [ "Invalid phone '123'", "Phone is too short" ],
 *              indexesInOriginalResponse: [ 0, 1 ],
 *          ],
 *          [
 *              // Has no value and will be applied based on just a name
 *              messages: [ "Something is wrong with phone for sure" ],
 *          ]
 *     },
 *     "promocodes[]": {
 *         [
 *             value: "FALL2020",
 *             messages: [ "The promocode has expired" ],
 *             indexesInOriginalResponse: [ 2 ],
 *         ],
 *         [
 *             value: "SUMMER2022",
 *             messages: [ "Unknown promocode" ],
 *             indexesInOriginalResponse: [ 3 ],
 *         ]
 *     },
 *     ...
 * }
 */
Freedom.FormsValidator.prototype.groupErrorsByNameAndValue = function (errorItems) {
    var i
        , item
        , fieldName
        , fieldValue
        , group
        , grouped = {}
        , messages;
    for (i = 0; i < errorItems.length; i++) {
        item = errorItems[i];
        if (fieldName = item.name) { // form-wide errors may have no 'name'
            fieldValue = item.value;
            messages = item.messages || [ item.message ];
            group = this.findErrorsGroupByNameAndValue(grouped, fieldName, fieldValue);
            if (!group) {
                group = {
                    indexesInOriginalResponse: [ i ],
                };
                if (!this.isFieldValueAbsent(fieldValue)) {
                    group.value = fieldValue;
                }
                group.messages = messages;
                grouped[fieldName] = (grouped[fieldName] || []).concat([ group ]);
            } else {
                group.indexesInOriginalResponse.push(i);
                group.messages = group.messages.concat(messages);
            }
        }
    }
    return grouped;
}

/**
 * @param {object} groupedItems
 * @param {string} name
 * @param {string|null|void} value
 * @param {boolean=false} matchOnNonEmptyValueOnly
 * @return {FormsValidator~ErrorsForValue|void}
 */
Freedom.FormsValidator.prototype.findErrorsGroupByNameAndValue = function (
    groupedItems,
    name,
    value,
    matchOnNonEmptyValueOnly
) {
    var groups = groupedItems[name];
    if (!groups) {
        return ;
    }
    var group, i;
    for (i = 0; i < groups.length; i++) {
        group = groups[i];
        if (
            value === group.value
            || (
                !matchOnNonEmptyValueOnly
                && this.isFieldValueAbsent(value)
                && this.isFieldValueAbsent(group.value)
            )
        ) {
            this.attendedErrorsIndexes = this.attendedErrorsIndexes.concat(
                group.indexesInOriginalResponse
            );
            return group;
        }
    }
}

Freedom.FormsValidator.prototype.isFieldValueAbsent = function(fieldValue) {
    return fieldValue === undefined || fieldValue === null;
}

// /**
//  * The method alters it's argument!
//  * @param {object}
//  * @return string[]
//  * */
// Freedom.FormsValidator.prototype.extractCommonErrorsFromGrouped = function(grouped) {
//     var groupWithCommonMessages = grouped[''];
//     // Removing form-wide errors from the list, just to keep things in order.
//     delete grouped[''];
//     return groupWithCommonMessages ? groupWithCommonMessages[0].messages : [];
// }

/**
 * @param {FormsValidator~ErrorData[]} errorItems
 * @return string[]
 * */
Freedom.FormsValidator.prototype.getUnattendedErrorMessagesFromResponse = function (errorItems) {
    var messages = []
        , errorItem;
    for (var i = 0; i < errorItems.length; i++) {
        if (this.attendedErrorsIndexes.indexOf(i) === -1) {
            errorItem = errorItems[i];
            messages = messages.concat(
                errorItem.messages || [ errorItem.message ]
            );
        }
    }
    return messages;
}

Freedom.FormsValidator.prototype.setCommonErrors = function (messages) {
    var commonBlock = this.settings.commonMessagesBlock.locate(
        this.form,
        this.submitButton
    );
    if (!commonBlock) {
        return ;
    }
    var errorBlock = commonBlock
        .filter('.' + this.settings.errorBlock.className);

    if (messages.length) {
        if (!errorBlock.length) {
            errorBlock = this.createErrorBlock();
            this.settings.commonMessagesBlock.insert(
                errorBlock,
                this.form,
                this.submitButton
            );
        }
        errorBlock.html( this.makeErrorBlockContents(messages) );
        this.refreshScrollPositionToBe(errorBlock);
    } else {
        if (errorBlock.length) {
            errorBlock.remove();
        }
    }
}

/**
 * @param {string} message
 */
Freedom.FormsValidator.prototype.setSuccessMessage = function (message) {
    var commonBlock = this.settings.commonMessagesBlock.locate(
        this.form,
        this.submitButton
    );
    if (!commonBlock) {
        return ;
    }
    var successBlock = commonBlock
        .filter('.' + this.settings.successBlock.className);
    if (message) {
        if (!successBlock.length) {
            successBlock = this.createSuccessBlock();
            this.settings.commonMessagesBlock.insert(
                successBlock,
                this.form,
                this.submitButton
            );
        }
        successBlock.html(message);
    } else {
        if (successBlock.length) {
            successBlock.remove();
        }
    }
}

Freedom.FormsValidator.prototype.createSuccessBlock = function () {
    return $(this.settings.successBlock.openingTagTemplate)
        .addClass(this.settings.successBlock.className);
}

/**
 * @param {jQuery} element
 * @param {FormsValidator~ajaxResponse} response
 */
Freedom.FormsValidator.prototype.applyOnEmptyErrorsAction = function(element, response) {
    var action = this.settings.onEmptyErrors;
    if (action) {
        if (typeof action === 'function') {
            action(element, response);
        } else {
            var animation = action.animation;
            if (typeof animation !== 'undefined') {
                setTimeout(
                    function () {
                        element[animation.type](animation.duration);
                    },
                    animation.delay
                );
            }
        }
    }
}
