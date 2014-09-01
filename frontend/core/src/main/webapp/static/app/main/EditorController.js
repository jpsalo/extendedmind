/* Copyright 2013-2014 Extended Mind Technologies Oy
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 'use strict';

 function EditorController($rootScope, $scope, $timeout) {

  $scope.titlebar = {};
  $scope.searchText = {};
  $scope.omnibarKeywords = {isVisible: false};

  var titleBarInputFocusCallbackFunction = {};
  var titleBarInputBlurCallbackFunction = {};

  // REGISTER CALLBACKS

  if (angular.isFunction($scope.registerEditorAboutToOpenCallback))
    $scope.registerEditorAboutToOpenCallback(editorAboutToOpen);

  if (angular.isFunction($scope.registerEditorOpenedCallback))
    $scope.registerEditorOpenedCallback(editorOpened);

  if (angular.isFunction($scope.registerEditorClosedCallback))
    $scope.registerEditorClosedCallback(editorClosed);

  // EDITOR INITIALIZATION

  function initializeTaskEditor(task) {
    $scope.titlebar.text = task.title;
    $scope.task = task;
  }

  function evaluateAndSetSaveOnClose() {
    if ($scope.editorType !== 'omnibar' &&
      $scope.titlebar &&
      $scope.titlebar.text &&
      $scope.titlebar.text.length > 0)
      $scope.saveOnClose = true;

    else $scope.saveOnClose = false;
  }

  $scope.titlebarTextKeyDown = function titlebarTextKeyDown(event) {
    // Escape
    // TODO: editor titlebar input blur is not working here
    if (event.keyCode === 27) blurTitlebarInput();
    // Return
    else if (event.keyCode === 13 && !$rootScope.isLoading && $scope.titlebarHasText()) {
      // Enter in editor saves, no line breaks allowed
      $scope.closeOmnibarDrawer();
      $scope.saveItemInEdit();
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // EDIT ITEM

  function getExtendedItemInEdit() {
    if ($scope.editorType === 'task') return $scope.task;
    //
    // TODO: others!
    //
  }

  function resetItemInEdit() {
    if ($scope.editorType === 'task') $scope.resetTask($scope.task);
    //
    // TODO: others
    //
  }

  function deleteNewListAndAddListToItemAndSaveItem(list) {
    delete $scope.newList;
    var extendedItemInEdit = getExtendedItemInEdit();
    if (extendedItemInEdit) {
      if (!extendedItemInEdit.transientProperties) extendedItemInEdit.transientProperties = {};
      extendedItemInEdit.transientProperties.list = list.uuid;
      $scope.saveItemInEdit();
    }
  }
  function deleteNewListAndSaveItem() {
    delete $scope.newList;
    $scope.saveItemInEdit();
    // TODO: throw meaningful error e.g. to toaster
  }

  $scope.saveItemInEdit = function saveItemInEdit() {
    if ($scope.newList && $scope.newList.title)
      $scope.addList($scope.newList).then(deleteNewListAndAddListToItemAndSaveItem, deleteNewListAndSaveItem);
    else {
      if ($scope.editorType === 'task') {
        $scope.task.title = $scope.titlebar.text;
        $scope.saveTask($scope.task);
      }
      //
      // TODO: others
      //
    }
  };

  $scope.titlebarHasText = function titlebarHasText() {
    return $scope.titlebar.text && $scope.titlebar.text.length !== 0;
  };

  // OPENING / CLOSING

  $scope.closeEditor = function closeEditor() {
    $scope.closeOmnibarDrawer();
    if ($scope.saveOnClose) $scope.saveItemInEdit();
    else resetItemInEdit();
  };

  function editorAboutToOpen(editorType, item) {
    if (editorType === 'omnibar') {
      // initializeOmnibar();
    } else if (editorType === 'task') {
      initializeTaskEditor(item);
    }/* else if (editorType === 'note') {
      initializeNoteEditor(item);
    } else if (editorType === 'list') {
      initializeListEditor(item);
    } else if (editorType === 'context') {
      initializeContextEditor(item);
    } else if (editorType === 'keyword') {
      initializeKeywordEditor(item);
    } else if (editorType === 'item') {
      initializeItemEditor(item);
    }*/
    $scope.editorType = editorType;
    $scope.isEditorVisible = true;
    evaluateAndSetSaveOnClose();
  }

  // Callback from Snap.js, outside of AngularJS event loop
  function editorOpened() {
    $scope.$apply(setFocusOnTitlebarInput);
  }

  // Callback from Snap.js, outside of AngularJS event loop
  function editorClosed() {
    $scope.$apply(clearAndHideEditor);
  }

  function clearAndHideEditor() {
    $scope.isEditorVisible = false;
    $scope.editorType = undefined;
    $scope.titlebar = {};
  }

  $scope.clearTitlebarText = function clearTitlebarText() {
    $scope.titlebar = {};
    currentTitlebarTextStyle = undefined;
  };

  // For empty omnibar search placeholder
  $scope.hideEmptyOmnibar = function hideEmptyOmnibar() {
    // TODO: replace things here with swiper from left to right
    blurTitlebarInput();
  };

  // UI COMPONENTS

  $scope.getTitlebarTextInputPlaceholder = function getTitlebarTextInputPlaceholder() {
    if ($scope.editorType === 'omnibar') return 'save to inbox / search...';
    else if ($scope.editorType === 'task') return 'add task';
    else if ($scope.editorType === 'note') return 'add note';
    else if ($scope.editorType === 'list') return 'add list';
    else if ($scope.editorType === 'context') return 'add context';
    else if ($scope.editorType === 'keyword') return 'add keyword';
    else if ($scope.editorType === 'item') return 'add item';
  };

  $scope.taskDescriptionFocus = function() {
    taskDescriptionHasFocus = true;
  };
  $scope.taskDescriptionBlur = function() {
    taskDescriptionHasFocus = false;
  };

  $scope.hideTaskProperties = function() {
    return taskDescriptionHasFocus;
  };

  $scope.isSearchActive = function isSearchActive() {
    return $scope.searchText.delayed && $scope.searchText.delayed.length > 1;
  };

  // Show search results with slight delay.
  $scope.$watch('titlebar.text', function(newTitle/*, oldTitle*/) {
    $scope.searchText.current = newTitle;
    if (newTitle && newTitle.length > 1) {
      // Use a delayed update for search
      $timeout(function() {
        if ($scope.searchText.current === newTitle)
          $scope.searchText.delayed = newTitle;
      }, 700);
    } else {
      $scope.searchText.delayed = undefined;
    }
    evaluateAndSetSaveOnClose();
  });

  // Titlebar text input focus/blur
  $scope.registerTitleBarInputFocusCallback = function registerTitleBarInputFocusCallback(callback) {
    titleBarInputFocusCallbackFunction = callback;
  };
  $scope.registerTitleBarInputBlurCallback = function registerTitleBarInputBlurCallback(callback) {
    titleBarInputBlurCallbackFunction = callback;
  };
  function setFocusOnTitlebarInput() {
    if (typeof titleBarInputFocusCallbackFunction === 'function') titleBarInputFocusCallbackFunction();
  }
  function blurTitlebarInput() {
    if (typeof titleBarInputBlurCallbackFunction === 'function') titleBarInputBlurCallbackFunction();
  }

  // CONTAINER DIMENSIONS

  var MAX_CONTAINER_HEIGHT = 769;
  var editorActionsHeight = 44, editorContainerHeight = 156, keyboardHeight = 0;
  function getEditorStaticContentHeight() {
    return editorContainerHeight - ($scope.editorType === 'item' ? editorActionsHeight : 0);
  }

  $scope.getEditorHeight = function getEditorHeight() {
    if ($scope.currentHeight <= MAX_CONTAINER_HEIGHT) {
      return $scope.currentHeight - getEditorStaticContentHeight() - keyboardHeight;
    } else {
      return MAX_CONTAINER_HEIGHT - getEditorStaticContentHeight() - keyboardHeight;
    }
  };

  // Layout for expanding text areas require a max height
  // that needs to be defined programmatically

  var taskDescriptionHasFocus = false;

  $scope.getEditTaskDescriptionMaxHeight = function() {
    var usedHeight = $scope.editorType === 'item' ? 0 : editorActionsHeight;
    if (taskDescriptionHasFocus) {
      usedHeight += 160;
    } else {
      usedHeight += 290;
      if ($scope.task && $scope.task.transientProperties && $scope.task.transientProperties.date) {
        usedHeight += 44;
      }
    }

    if ($scope.currentHeight <= MAX_CONTAINER_HEIGHT) {
      var calculatedHeight = $scope.currentHeight - usedHeight - keyboardHeight;
      return (calculatedHeight < 44 ? 44 : calculatedHeight);
    } else {
      return MAX_CONTAINER_HEIGHT - usedHeight - keyboardHeight;
    }
  };

  $scope.getEditNoteContentMaxHeight = function() {
    var usedHeight = $scope.editorType === 'item' ? 0 : editorActionsHeight;
    usedHeight += 112;  // reduce by this much to fit content into view
    if ($scope.currentHeight <= MAX_CONTAINER_HEIGHT) {
      var calculatedHeight = $scope.currentHeight - usedHeight - keyboardHeight;
      return (calculatedHeight < 44 ? 44 : calculatedHeight);
    } else {
      return MAX_CONTAINER_HEIGHT - usedHeight - keyboardHeight;
    }
  };

  $scope.getSearchPlaceholderMaxHeight = function() {
    var usedHeight = 44 + getEditorStaticContentHeight();
    if ($scope.currentHeight <= MAX_CONTAINER_HEIGHT) {
      return $scope.currentHeight - usedHeight - keyboardHeight;
    } else {
      return MAX_CONTAINER_HEIGHT - usedHeight - keyboardHeight;
    }
  };

  /**
  * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
  *
  * @param {String} text The text to be rendered.
  * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
  *
  * @see http://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
  */
  function getTextWidth(text, font) {
    // re-use canvas object for better performance
    var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement('canvas'));
    var context = canvas.getContext('2d');
    context.font = font;
    var metrics = context.measureText(text);
    return metrics.width;
  }

  var currentTitlebarTextStyle;
  $scope.getTitlebarClass = function getTitlebarClass() {
    if ($scope.titlebar.text && $scope.titlebar.text.length > 10) {
      var editorWidth;
      if ($rootScope.currentWidth >= 568) {
        // Maximum width for column
        editorWidth = 470;
      } else {
        editorWidth = $rootScope.currentWidth - 98;
      }

      var fontSize = '21px';
      if (currentTitlebarTextStyle === 'omnibar-input-very-long') {
        fontSize = '12px';
      } else if (currentTitlebarTextStyle === 'omnibar-input-long') {
        fontSize = '15px';
      } else if (currentTitlebarTextStyle === 'omnibar-input-medium') {
        fontSize = '18px';
      }

      var currentTextWidth = getTextWidth($scope.titlebar.text, fontSize + ' sans-serif');
      if (currentTitlebarTextStyle === 'omnibar-input-very-long' || (currentTextWidth / 2 + 25) > editorWidth) {
        if (currentTitlebarTextStyle !== 'omnibar-input-very-long') {
          $rootScope.$broadcast('elastic:adjust');
          currentTitlebarTextStyle = 'omnibar-input-very-long';
        }
      }
      else if (currentTitlebarTextStyle === 'omnibar-input-long' || (currentTextWidth / 2 + 35) > editorWidth) {
        if (currentTitlebarTextStyle !== 'omnibar-input-long') {
          $rootScope.$broadcast('elastic:adjust');
          currentTitlebarTextStyle = 'omnibar-input-long';
        }
      } else if (currentTitlebarTextStyle === 'omnibar-input-medium' || (currentTextWidth + 20) > editorWidth) {
        if (currentTitlebarTextStyle !== 'omnibar-input-medium') {
          $rootScope.$broadcast('elastic:adjust');
          currentTitlebarTextStyle = 'omnibar-input-medium';
        }
      } else {
        currentTitlebarTextStyle = undefined;
      }
      return currentTitlebarTextStyle;
    } else {
      currentTitlebarTextStyle = undefined;
    }
  };

  // EDIT ITEM SCROLLER

  var editItemHasScrollerIndicators = false;
  var editItemScrollerActiveSlideIndex = 0;
  var gotoEditItemScrollerSlideFn;

  $scope.showEditItemScrollerIndicators = function showEditItemScrollerIndicators() {
    return editItemHasScrollerIndicators;
  };

  $scope.setEditItemHasScrollerIndicators = function setEditItemHasScrollerIndicators(hasIndicators) {
    editItemHasScrollerIndicators = hasIndicators;
  };

  $scope.isEditItemScrollerSlideActive = function isEditItemScrollerSlideActive(slideName) {
    return (slideName === 'left' && editItemScrollerActiveSlideIndex === 0) || (slideName === 'right' && editItemScrollerActiveSlideIndex === 1);
  };

  $scope.setActiveSlideIndex = function setActiveSlideIndex(slideIndex) {
    editItemScrollerActiveSlideIndex = slideIndex;
  };

  $scope.registerGotoEditItemScrollerSlideFn = function registerGotoEditItemScrollerSlideFn(gotoSlideFn) {
    gotoEditItemScrollerSlideFn = gotoSlideFn;
  };

  $scope.gotoEditItemScrollerSlide = function gotoEditItemScrollerSlide(slideName) {
    var slideIndex;
    if (slideName === 'left')
      slideIndex = 0;
    else if (slideName === 'right')
      slideIndex = 1;
    gotoEditItemScrollerSlideFn(slideIndex);
  };

  // KEYWORDS

  var selectedOmnibarKeywords = [];

  $scope.getSelectedAndFilterUnselectedKeywords = function getSelectedAndFilterUnselectedKeywords() {
    if ($scope.searchText.delayed) {
      return $scope.keywords.filter(function(keyword) {
        return selectedOmnibarKeywords.indexOf(keyword) !== -1 || keyword.title.indexOf($scope.searchText.delayed) !== -1;
      });
    } else {
      return $scope.keywords;
    }
  };

  $scope.getFilteredOmnibarNotes = function getFilteredOmnibarNotes() {
    // show nothing if no keywords selected
    if (selectedOmnibarKeywords.length) {
      var filteredNotes = [];

      $scope.notes.forEach(function(note) {
        if (note.relationships && note.relationships.tags) {
          if (selectedOmnibarKeywords.every(function(keyword) {
            return (note.relationships.tags.indexOf(keyword.uuid) !== -1);
          })) {
            filteredNotes.push(note);
          }
        }
      });
      return filteredNotes;
    }
  };

  $scope.toggleKeywordSelected = function toggleKeywordSelected(keyword) {
    var toggledKeywordIndex = selectedOmnibarKeywords.indexOf(keyword);
    if (toggledKeywordIndex === -1) {
      selectedOmnibarKeywords.push(keyword);
    } else {
      selectedOmnibarKeywords.splice(toggledKeywordIndex, 1);
    }
  };

  $scope.toggleOmnibarKeywordsVisible = function toggleOmnibarKeywordsVisible() {
    $scope.omnibarKeywords.isVisible = !$scope.omnibarKeywords.isVisible;
    if ($scope.omnibarKeywords.isVisible) selectedOmnibarKeywords = [];
  };

  // EDIT ITEM

  function initializeOmnibarItem(feature, item) {
    $scope.titlebar.text = item.title;
    $scope[feature] = item;
  }

  $scope.addItemInOmnibar = function addItemInOmnibar(item, feature) {
    initializeOmnibarItem(feature, item);
    $scope.openOmnibar(feature);
  };
}

EditorController['$inject'] = ['$rootScope', '$scope', '$timeout'];
angular.module('em.main').controller('EditorController', EditorController);