/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2012 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Procedure blocks for Scratch.
 */
'use strict';

export default function (vm, useCatBlocks) {
  const Blockly = useCatBlocks ? require('cat-blocks') : require('scratch-blocks');

  Blockly.JAVASCRIPT_CALL_BLOCK_TYPE = 'javascript_call';
  Blockly.JAVSCRIPT_VAR_ARGUMENT = "VAR";
  Blockly.JAVSCRIPT_FUNCTION_ARGUMENT = "FUNCTION";
  Blockly.Procedures.RETURN_TYPE = Object.freeze({
    NOTHING:   "nothing",
    NUMBER:  "number",
    STRING: "string",
    BOOLEAN: "boolean"
  });
  const WITH_LABEL = "with";
  const JAVASCRIPT_COLOR1 = "#32a172"
  const JAVASCRIPT_COLOR2 = "#2a8c63"
  const JAVASCRIPT_COLOR3 = "#1c875a"

  if (!Blockly.ScratchBlocks.JavascriptCallUtils) {
    Blockly.ScratchBlocks.JavascriptCallUtils = {};
  } 
  
  let originalEditProcedureCallbackFactory = Blockly.Procedures.editProcedureCallbackFactory_;
  Blockly.Procedures.editProcedureCallbackFactory_ = function(block) {
    if (block.type == Blockly.JAVASCRIPT_CALL_BLOCK_TYPE)  {
      return function(mutation) {
        if (mutation) {
          // Copied from Blockly.Procedures.mutateCallersAndPrototype
          var oldMutationDom = block.mutationToDom();
          var oldMutation = oldMutationDom && Blockly.Xml.domToText(oldMutationDom);
          block.domToMutation(mutation);
          var newMutationDom = block.mutationToDom();
          var newMutation = newMutationDom && Blockly.Xml.domToText(newMutationDom);
          if (oldMutation != newMutation) {
            Blockly.Events.fire(new Blockly.Events.BlockChange(
            block, 'mutation', null, oldMutation, newMutation));
          }
        }
      };
    } else {
      return originalEditProcedureCallbackFactory(block);
    }
  }

  /**
   * Create XML to represent the arguments and the returnType of a javascript
   * call block.
   * @return {!Element} XML storage element.
   * @this Blockly.Block
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.callerMutationToDom = function () {
    var container = Blockly.ScratchBlocks.ProcedureUtils.callerMutationToDom.call(this);
    container.setAttribute('returntype', JSON.stringify(this.returnType_));
    container.setAttribute('argumentnames', JSON.stringify(this.displayNames_));
    container.setAttribute('argumentdefaults', JSON.stringify(this.argumentDefaults_));
    return container;
  };

  /**
   * @see Blockly.ScratchBlocks.JavascriptCallUtils.callerDomToMutation()
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.callerDomToMutation = function (xmlElement) {
    this.returnType_ = JSON.parse(xmlElement.getAttribute('returntype'));
    this.displayNames_ = JSON.parse(xmlElement.getAttribute('argumentnames'));
    this.argumentDefaults_ = JSON.parse(xmlElement.getAttribute('argumentdefaults'));

    // This is needed because we have the errors like:
    // "Remove output connection prior to adding previous connection"
    // "Remove previous connection prior to adding output connection"
    // ...
    // when changing from extension "output_..." to "shape_statement" and back
    this.setPreviousStatement(null);
    this.setNextStatement(null);
    this.setOutput(false);

    switch (this.returnType_) {
      case Blockly.Procedures.RETURN_TYPE.NUMBER:
        Blockly.Extensions.apply("output_number", this, false);
        break;
      case Blockly.Procedures.RETURN_TYPE.STRING:
        Blockly.Extensions.apply("output_string", this, false);
        break;
      case Blockly.Procedures.RETURN_TYPE.BOOLEAN:
        Blockly.Extensions.apply("output_boolean", this, false);
        break;
      case Blockly.Procedures.RETURN_TYPE.NOTHING:
        Blockly.Extensions.apply("shape_statement", this, false);
        break;
      default:
        break;
    }
  
    Blockly.ScratchBlocks.ProcedureUtils.callerDomToMutation.call(this, xmlElement);
  };

  /**
   * @see Blockly.ScratchBlocks.JavascriptCallUtils.definitionMutationToDom()
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.definitionMutationToDom = function (
    opt_generateShadows) {
    var container = Blockly.ScratchBlocks.ProcedureUtils.definitionMutationToDom.call(this, opt_generateShadows);
    container.setAttribute('returntype', JSON.stringify(this.returnType_));
    return container;
  };

  /**
   * @see Blockly.ScratchBlocks.ProcedureUtils.definitionDomToMutation()
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.definitionDomToMutation = function (xmlElement) {
    this.returnType_ = JSON.parse(xmlElement.getAttribute('returntype'));
    Blockly.ScratchBlocks.ProcedureUtils.definitionDomToMutation.call(this, xmlElement);
  };

  /**
   * @see Blockly.ScratchBlocks.ProceduresUtils.disconnectOldBlocks_()
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.disconnectOldBlocks_ = function () {
    // We want to both reuse the code from  `Blockly.ScratchBlocks.JavascriptCallUtils.disconnectOldBlocks_` 
    // and also avoid this logic for `var` and `function` arguments
    // The only solution found was to temporary remove those two special inputs
    let inputListBackup = this.inputList;
    this.inputList =  this.inputList.filter((input) => ! (input.name == Blockly.JAVSCRIPT_VAR_ARGUMENT || input.name == Blockly.JAVSCRIPT_FUNCTION_ARGUMENT));
    
    let connectionMap = Blockly.ScratchBlocks.ProcedureUtils.disconnectOldBlocks_.call(this);

    this.inputList = inputListBackup;
    return connectionMap;
  };

  /**
   * @see Blockly.ScratchBlocks.ProceduresUtils.removeAllInputs_
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.removeAllInputs_ = function () {
    // Delete inputs directly instead of with block.removeInput to avoid splicing
    // out of the input list at every index.
    let newInputList = [];
    for (var i = 0, input; input = this.inputList[i]; i++) {
      if (input.type == Blockly.DUMMY_INPUT && (input.fieldRow.length == 0 || input.fieldRow[0].text_ != WITH_LABEL)
        || input.name == Blockly.JAVSCRIPT_VAR_ARGUMENT
        || input.name == Blockly.JAVSCRIPT_FUNCTION_ARGUMENT) {
        newInputList.push(input);
      } else {
        input.dispose();
      }
    }
    this.inputList = newInputList;
  };

  /**
   * @see Blockly.ScratchBlocks.ProcedureUtils.createAllInputs_()
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.createAllInputs_ = function (connectionMap) {
    if (this.addPrefixBeforeArguments && this.procCode_.length > 0) {
      this.addPrefixBeforeArguments();
    }
    Blockly.ScratchBlocks.ProcedureUtils.createAllInputs_.call(this, connectionMap);
  };

  /**
   * @see  Blockly.ScratchBlocks.ProcedureUtils.updateDeclarationProcCode_()
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.updateDeclarationProcCode_ = function () {
    // We want to both reuse the code from  `Blockly.ScratchBlocks.JavascriptCallUtils.updateDeclarationProcCode_` 
    // and also avoid this logic for dummy_input text input "input"
    // The only solution found was to temporary remove those two special inputs
    let inputListBackup = this.inputList;
    this.inputList =  this.inputList.filter((input) => !(input.type == Blockly.DUMMY_INPUT));
    
    Blockly.ScratchBlocks.ProcedureUtils.updateDeclarationProcCode_.call(this);

    this.inputList = inputListBackup;
  };

  /**
   * Focus on the last argument editor or label editor on the block.
   * @private
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.focusLastEditor_ = function () {
    if (this.inputList.length > 0) {
      var newInput = this.inputList[this.inputList.length - 1];
      if (newInput.type !== Blockly.DUMMY_INPUT && newInput.name !== Blockly.JAVSCRIPT_FUNCTION_ARGUMENT) {
        Blockly.ScratchBlocks.ProcedureUtils.focusLastEditor_.call(this);
      }
    }
  };

  Blockly.ScratchBlocks.JavascriptCallUtils.addPrefixBeforeArguments = function() {
    this.appendDummyInput().appendField(WITH_LABEL);
  }

  /**
   * Externally-visible function to get the returnType on procedure declaration.
   * @return {string} The value of the returnType_ property.
   * @public
   */
  Blockly.ScratchBlocks.JavascriptCallUtils.getReturnType = function () {
    return this.returnType_;
  };

  Blockly.ScratchBlocks.JavascriptCallUtils.setReturnType = function(returnType) {
    this.returnType_ = returnType;
  }

  Blockly.ScratchBlocks.JavascriptCallUtils.makeEditOption = function(block) {
    var editOption = {
      enabled: true,
      text: Blockly.Msg.EDIT_PROCEDURE,
      callback: function() {
        Blockly.Procedures.externalProcedureDefCallback(
          block.mutationToDom(),
          Blockly.Procedures.editProcedureCallbackFactory_(block),
          true
        );
      }
    };
    return editOption;
  };

  Blockly.ScratchBlocks.VerticalExtensions.JAVASCRIPT_CALL_CONTEXTMENU = {
    /**
     * Add the "edit" option to the context menu.
     * @todo Add "go to definition" option once implemented.
     * @param {!Array.<!Object>} menuOptions List of menu options to edit.
     * @this Blockly.Block
     */
    customContextMenu: function(menuOptions) {
      menuOptions.push(Blockly.ScratchBlocks.JavascriptCallUtils.makeEditOption(this));
    }
  };

  // console.log("*************************************javascript_call_contextmenu");
  Blockly.Extensions.registerMixin('javascript_call_contextmenu', Blockly.ScratchBlocks.VerticalExtensions.JAVASCRIPT_CALL_CONTEXTMENU);

  // The below two blocks reuses code from already existing `procedures_call`/`procedures_definition` blocks defined in `scratch-blocks` project (see procedures.js file)
  // This is done by wrapping the underlying functions (like `mutationToDom`) defined in `Blockly.ScratchBlocks.ProcedureUtils` 
  Blockly.Blocks[Blockly.JAVASCRIPT_CALL_BLOCK_TYPE] = {
    /**
     * Block for calling a procedure with no return value.
     * @this Blockly.Block
     */
    init: function () {
      this.jsonInit({
        "message0": "call %1 %2",
        "args0": [
          {
            "type": "input_value",
            "name": Blockly.JAVSCRIPT_VAR_ARGUMENT
          },
          {
            "type": "input_value",
            "name": Blockly.JAVSCRIPT_FUNCTION_ARGUMENT
          }
        ],
        "colour": "#c78ade",
        "colourSecondary": "#b481c7",
        "colourTertiary": "#a668bd",
        "colourQuaternary": "#a668bd",
        "extensions": ["javascript_call_contextmenu", "output_string"]
      });
      this.procCode_ = '';
      this.argumentIds_ = [];
      this.warp_ = false;
      this.returnType_ = Blockly.Procedures.RETURN_TYPE.STRING;

      this.displayNames_ = [];
      this.argumentDefaults_ = [];
    },
    // Shared. 
    getProcCode: Blockly.ScratchBlocks.ProcedureUtils.getProcCode,
    removeAllInputs_: Blockly.ScratchBlocks.JavascriptCallUtils.removeAllInputs_,
    disconnectOldBlocks_: Blockly.ScratchBlocks.JavascriptCallUtils.disconnectOldBlocks_,
    deleteShadows_: Blockly.ScratchBlocks.ProcedureUtils.deleteShadows_,
    createAllInputs_: Blockly.ScratchBlocks.JavascriptCallUtils.createAllInputs_,
    updateDisplay_: Blockly.ScratchBlocks.ProcedureUtils.updateDisplay_,

    // Exist on both blocks: javascript_call and javascript_call_inputs, but have different implementations.
    mutationToDom: Blockly.ScratchBlocks.JavascriptCallUtils.callerMutationToDom,
    domToMutation: Blockly.ScratchBlocks.JavascriptCallUtils.callerDomToMutation,
    populateArgument_: Blockly.ScratchBlocks.ProcedureUtils.populateArgumentOnCaller_,
    addProcedureLabel_: Blockly.ScratchBlocks.ProcedureUtils.addLabelField_,

    // Only exists on this.
    attachShadow_: Blockly.ScratchBlocks.ProcedureUtils.attachShadow_,
    buildShadowDom_: Blockly.ScratchBlocks.ProcedureUtils.buildShadowDom_,
    addPrefixBeforeArguments: Blockly.ScratchBlocks.JavascriptCallUtils.addPrefixBeforeArguments
  };

  Blockly.Blocks['javascript_call_inputs'] = {
    /**
     * The root block in the call inputs editor.
     * @this Blockly.Block
     */
    init: function () {
      this.jsonInit({
        "message0": "inputs",
        "colour": "#c78ade",
        "colourSecondary": "#b481c7",
        "colourTertiary": "#a668bd",
        "colourQuaternary": "#a668bd",
        "extensions": ["output_string"]
      });
      /* Data known about the procedure. */
      this.procCode_ = 'inputs';
      this.displayNames_ = [];
      this.argumentIds_ = [];
      this.argumentDefaults_ = [];
      this.warp_ = false;
      this.returnType_ = Blockly.Procedures.RETURN_TYPE.NOTHING;
    },
    // Shared.
    getProcCode: Blockly.ScratchBlocks.ProcedureUtils.getProcCode,
    removeAllInputs_: Blockly.ScratchBlocks.JavascriptCallUtils.removeAllInputs_,
    disconnectOldBlocks_: Blockly.ScratchBlocks.JavascriptCallUtils.disconnectOldBlocks_,
    deleteShadows_: Blockly.ScratchBlocks.ProcedureUtils.deleteShadows_,
    createAllInputs_: Blockly.ScratchBlocks.JavascriptCallUtils.createAllInputs_,
    updateDisplay_: Blockly.ScratchBlocks.ProcedureUtils.updateDisplay_,

    // Exist on both blocks: javascript_call and javascript_call_inputs, but have different implementations.
    mutationToDom: Blockly.ScratchBlocks.JavascriptCallUtils.definitionMutationToDom,
    domToMutation: Blockly.ScratchBlocks.JavascriptCallUtils.definitionDomToMutation,
    populateArgument_: Blockly.ScratchBlocks.ProcedureUtils.populateArgumentOnDeclaration_,
    addProcedureLabel_: ()=>{},
    removeFieldCallback: Blockly.ScratchBlocks.ProcedureUtils.removeFieldCallback,

    // Only exist on javascript_call_inputs.
    createArgumentEditor_: Blockly.ScratchBlocks.ProcedureUtils.createArgumentEditor_,
    focusLastEditor_: Blockly.ScratchBlocks.JavascriptCallUtils.focusLastEditor_,
    getWarp: Blockly.ScratchBlocks.ProcedureUtils.getWarp,
    setWarp: Blockly.ScratchBlocks.ProcedureUtils.setWarp,
    setReturnType: Blockly.ScratchBlocks.JavascriptCallUtils.setReturnType,
    getReturnType: Blockly.ScratchBlocks.JavascriptCallUtils.getReturnType,
    addLabelExternal: Blockly.ScratchBlocks.ProcedureUtils.addLabelExternal,
    addBooleanExternal: Blockly.ScratchBlocks.ProcedureUtils.addBooleanExternal,
    addStringNumberExternal: Blockly.ScratchBlocks.ProcedureUtils.addStringNumberExternal,
    onChangeFn: Blockly.ScratchBlocks.JavascriptCallUtils.updateDeclarationProcCode_
  };

  Blockly.Blocks['argument_reporter_boolean'] = {
    init: function () {
      this.jsonInit({
        "message0": " %1",
        "args0": [
          {
            "type": "field_label_serializable",
            "name": "VALUE",
            "text": ""
          }
        ],
        "extensions": ["colours_more", "output_boolean"]
      });
    }
  };

  Blockly.Blocks['javascript_javascript'] = {
    init: function () {
        this.jsonInit({
            "message0": "JavaScript %1",
            "args0": [
                {
                    "type": "input_value",
                    "name": "JAVASCRIPT"
                }
            ],
            "colour": JAVASCRIPT_COLOR1,
            "colourSecondary": JAVASCRIPT_COLOR2,
            "colourTertiary": JAVASCRIPT_COLOR3,
            "colourQuaternary": JAVASCRIPT_COLOR3,
            "extensions": ["shape_statement"]
        });
    }
  };

  Blockly.Blocks['javascript_set'] = {
      init: function () {
          this.jsonInit({
              "message0": "set %1 to %2",
              "args0": [
                  {
                      "type": "input_value",
                      "name": "VAR" 
                  },
                  {
                      "type": "input_value",
                      "name": "VALUE"
                  }
              ],
              "colour": "#018a3f",
              "colourSecondary": "#09753a",
              "colourTertiary": "#02662f",
              "colourQuaternary": "#02662f",
              "extensions": ["shape_statement"]
          });
      }
  };

  Blockly.Blocks["javascript_get"] = {
      init: function () {
          this.jsonInit({
              "message0": "get %1",
              "args0": [
                  {
                      "type": "input_value",
                      "name": "VAR" 
                  }
              ],
              "colour": "#0215a8",
              "colourSecondary": "#091994",
              "colourTertiary": "#031182",
              "colourQuaternary": "#031182",
              "extensions": ["output_string"]
          });
      }
  };

  Blockly.Blocks["javascript_new"] = {
      init: function () {
          this.jsonInit({
              "message0": "new %1",
              "args0": [
                  {
                      "type": "input_value",
                      "name": "TYPE" 
                  }
              ],
              "colour": "#94fa70",
              "colourSecondary": "#8ce06e",
              "colourTertiary": "#6fcf4c",
              "colourQuaternary": "#6fcf4c",
              "extensions": ["output_string"]
          });
      }
  };

  Blockly.Blocks["javascript_textdropdown_with_autocomplete"] = {
      init: function () {
        debugger;
          this.jsonInit({
              "message0": "%1",
              "args0": [
                  {
                      "type": "field_input",
                      "name": "TEXT",
                      //TODO DB: For v2 This options should be populated with the available variables
                      // options: function () {
                      //     return [];
                      // }
                  }
              ],
              "output": "String",
              "outputShape": Blockly.OUTPUT_SHAPE_ROUND,
              "colour": "#ebf05d",
              "colourSecondary": "#ebf05d",
              "colourTertiary": "#c1c43d",
              "colourQuaternary": "#c1c43d"
          });
      }
  };

  Blockly.FieldJavascriptTextDropdown = class FieldJavascriptTextDropdown extends Blockly.FieldTextDropdown {
    constructor(text, menuGenerator, opt_validator, opt_restrictor) {
      this.menuGenerator_ = menuGenerator;
      Blockly.FieldTextDropdown.prototype.trimOptions_.call(this);
      super(this, text, opt_validator, opt_restrictor);
    }
  }
  
  Blockly.Field.register('field_javascript_textdropdown', Blockly.FieldJavascriptTextDropdown);
  // Blockly.FieldJavascriptTextDropdown = function(text, menuGenerator, opt_validator, opt_restrictor) {
  //   this.menuGenerator_ = menuGenerator;
  //   Blockly.FieldJavascriptTextDropdown.prototype.trimOptions_.call(this);
  //   super(this, text, opt_validator, opt_restrictor);
  //   this.addArgType('javascripttextdropdown');
  // };

  // goog.inherits(Blockly.FieldJavascriptTextDropdown, Blockly.FieldTextDropdown);


  //field_javascript_variable_textdropdown

  // for the javascript blocks we have used "type": "field_textdropdown",
  // but it seems that this field type had some bugs (throws some errors when using it).
  // Because I didn't found this field type mentioned in the official documentation,
  // it looks to me that this is not supported (it was develop but for some reason was not maintained)
  // But with the below small ajustments I saw that this component works:
  Blockly.FieldTextDropdown.prototype.isOptionListDynamic = Blockly.FieldDropdown.prototype.isOptionListDynamic;
  Blockly.FieldTextDropdown.prototype.getOptions = Blockly.FieldDropdown.prototype.getOptions;
  Blockly.FieldTextDropdown.prototype.onItemSelected = Blockly.FieldDropdown.prototype.onItemSelected;
}