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

 function NoteEditorController($scope, $timeout, NotesService, SwiperService,
                               TagsService, UISessionService) {

  if ($scope.mode === 'omnibar') {
    // Dirtily set flag on to remove flicker when note editor is rendered.
    $scope.contentFocused = true;
  }


  // INITIALIZING

  if (angular.isFunction($scope.registerFeatureEditorAboutToCloseCallback))
    $scope.registerFeatureEditorAboutToCloseCallback(noteEditorAboutToClose, 'NoteEditorController');

  $scope.noteStatus = 'back';
  var savedTimer, savedTimerInner;
  function noteEdited() {
    $scope.noteStatus = 'saving';
    if (savedTimer) {
      $timeout.cancel(savedTimer);
      if (savedTimerInner) $timeout.cancel(savedTimerInner);
    }

    savedTimer = $timeout(function() {
      $scope.noteStatus = 'saved';
      savedTimerInner = $timeout(function() {
        $scope.noteStatus = 'back';
      }, 1000);
    }, 1000);
  }

  // SAVING, DELETING

  function saveNoteInEdit() {
    // TODO: Keywords
    $scope.deferEdit().then(function() {
      $scope.saveNote($scope.note);
    });
  }

  $scope.deleteNoteInEdit = function() {
    $scope.processDelete($scope.note, $scope.deleteNote, $scope.undeleteNote);
  };

  $scope.isNoteEdited = function() {
    // Note without title is unedited
    if ($scope.noteTitlebarHasText()) {
      return NotesService.isNoteEdited($scope.note, UISessionService.getActiveUUID());
    }
  };

  $scope.endNoteEdit = $scope.closeEditor;

  function noteEditorAboutToClose() {
    if (angular.isFunction($scope.unregisterEditorAboutToCloseCallback))
      $scope.unregisterEditorAboutToCloseCallback('NoteEditorController');

    if ($scope.isNoteEdited() && !$scope.note.trans.deleted){
      if ($scope.features.notes.getStatus() === 'onboarding_1'){
        $scope.increaseOnboardingPhase('notes');
      }
      saveNoteInEdit();
    }else{
      NotesService.resetNote($scope.note, UISessionService.getActiveUUID());
    }
  }

  function setSaving() {
    if (!$scope.isAutoSavingPrevented() && $scope.noteTitlebarHasText()) {
      $scope.noteStatus = 'saving';
      return Date.now();
    }
  }

  var setSavedTimer, resetNoteStatusTimer;
  function setSaved(savingSetTime) {
    if (!$scope.noteTitlebarHasText()) return;

    function doSetSaved() {
      $scope.noteStatus = 'saved';
      resetNoteStatusTimer = $timeout(function() {
        $scope.noteStatus = 'back';
      }, 1000);
    }

    if (setSavedTimer) {
      $timeout.cancel(setSavedTimer);
      if (resetNoteStatusTimer) {
        $timeout.cancel(resetNoteStatusTimer);
      }
    }

    if (backTimer) $timeout.cancel(backTimer);

    var saving = Date.now() - savingSetTime;
    if (saving < 1000)
      setSavedTimer = $timeout(doSetSaved, 1000 - saving);
    else
      doSetSaved();
  }

  $scope.clickFavorite = function() {
    var savingSetTime = setSaving();

    var favoritePromise;
    if (!$scope.note.trans.favorited)
      favoritePromise = $scope.favoriteNote($scope.note);
    else
      favoritePromise = $scope.unfavoriteNote($scope.note);

    if (favoritePromise) {
      favoritePromise.then(function() {
        setSaved(savingSetTime);
      });
    } else {
      setSaved(savingSetTime);
    }
  };

  // MODES

  $scope.setNoteContentFocus = function(focus) {
    $scope.contentFocused = focus;
    // FIXME: Maybe some directive with focus, blur event listeners, swiper and drawer.
    SwiperService.setOnlyExternal('noteEditor', focus);
  };

  $scope.gotoTitle = function() {
    if (typeof gotoTitleCallback === 'function') gotoTitleCallback();
    if (!$scope.isFirstSlide('noteEditor')) $scope.swipeToBasic('noteEditor');
  };

  var gotoTitleCallback;
  $scope.registerGotoTitleCallback = function(callback) {
    gotoTitleCallback = callback;
  };

  $scope.isNotePropertyInEdit = function() {
    return $scope.contentFocused || $scope.isPickerOpen();
  };

  $scope.isEndNoteEditActionHidden = function() {
    return $scope.isPickerOpen();
  };

  $scope.isPickerOpen = function() {
    return $scope.listPickerOpen || $scope.keywordsPickerOpen;
  };

  // CONTENT

  var noteContentFocusCallback;
  $scope.registerNoteContentInputCallbacks = function(focus){
    noteContentFocusCallback = focus;
    if ($scope.mode === 'omnibar') {
      // Execute focus right away.
      noteContentFocusCallback();
    }
  };

  $scope.$watch('note.trans.content', function(newValue, oldValue) {
    if (newValue && !oldValue && (!$scope.note.trans.title || !$scope.note.trans.title.length)) {
      // Set untitled as title when title is missing but there is content
      $scope.note.trans.title = 'untitled';
    }
    if (newValue !== oldValue) $scope.inputChanged();
  });

  // TITLEBAR

  $scope.noteTitlebarHasText = function() {
    return $scope.note.trans.title && $scope.note.trans.title.length !== 0;
  };

  var pollForSaveReady = {
    value: true
  };

  var noteSavingInProgress, backTimer;
  var saveNoteDebounced = function() {
    if (!noteSavingInProgress) {
      noteSavingInProgress = true;
      $scope.saveNote($scope.note, pollForSaveReady).then(function() {
        $scope.noteStatus = 'saved';
        backTimer = $timeout(function() {
          $scope.noteStatus = 'back';
        }, 1000);
        noteSavingInProgress = false;
      }, function() {
        noteSavingInProgress = false;
      });
    }
  }.debounce(1000);

  $scope.autoSaveNote = function() {
    if (!$scope.isAutoSavingPrevented() && $scope.noteTitlebarHasText()) {
      var savingSetTime = setSaving();
      $scope.saveNote($scope.note).then(function() {
        setSaved(savingSetTime);
      });
    }
  };

  $scope.inputChanged = function() {
    if (!$scope.isAutoSavingPrevented()) {

      if (setSavedTimer) {
        $timeout.cancel(setSavedTimer);
        if (resetNoteStatusTimer) {
          $timeout.cancel(resetNoteStatusTimer);
        }
      }

      if (backTimer) $timeout.cancel(backTimer);
      $scope.noteStatus = 'saving';
      saveNoteDebounced();
    }
  };

  $scope.noteTitlebarTextKeyDown = function (keydownEvent) {
    $scope.handleBasicTitlebarKeydown(keydownEvent, $scope.note);
    // Return
    if (event.keyCode === 13){
      noteContentFocusCallback();
      event.preventDefault();
      event.stopPropagation();
    } else if (event.keyCode === 8 && $scope.note.trans.title === 'untitled'){
      // When pressing backspace on 'untitled', remove the entire title
      $scope.note.trans.title = undefined;
    }
  };

  // KEYWORDS

  function clearKeyword() {
    $scope.newKeyword = TagsService.getNewTag({tagType: 'keyword'}, UISessionService.getActiveUUID());
  }
  clearKeyword(); // Initialize new keyword.

  $scope.addNewKeywordToNote = function(note, newKeyword) {
    if (!newKeyword || !newKeyword.trans.title) return; // No text entered.
    if (note.trans.keywords) {
      var noteKeyword = note.trans.keywords.findFirstObjectByKeyValue('title', newKeyword.trans.title);

      if (noteKeyword !== undefined) {
        // Note's existing keyword. Do not re-add.
        clearKeyword();
        return;
      }
    }

    var keywordToAdd = $scope.keywords.findFirstObjectByKeyValue('title', newKeyword.trans.title,
                                                                 'trans') || newKeyword;
    // Add already existing keyword or newly created keyword.
    $scope.addKeywordToNote(note, keywordToAdd);
  };

  $scope.addKeywordToNote = function(note, keyword) {
    function doAddKeywordToNote(note, keyword){
      if (!$scope.note.trans.keywords) $scope.note.trans.keywords = [];
      $scope.note.trans.keywords.push(keyword);
      clearKeyword();
      if (!$scope.isAutoSavingPrevented()) $scope.saveNote($scope.note).then(function() {
        setSaved(savingSetTime);
      });
    }
    var savingSetTime = setSaving();

    if (!keyword.trans.uuid){
      // Save new keyword immediately to prevent problems with sorting
      $scope.saveKeyword(keyword).then(function(){
        doAddKeywordToNote(note, keyword);
      });
    }else {
      doAddKeywordToNote(note, keyword);
    }
  };

  $scope.removeKeywordFromNote = function(note, keyword) {
    note.trans.keywords.splice(note.trans.keywords.indexOf(keyword), 1);
  };

  $scope.getKeywordsListString = function(note) {
    var keywordsList = '';

    for (var i = 0; i < note.trans.keywords.length; i++) {
      keywordsList += '#' + note.trans.keywords[i].trans.title; // Add hash character into keyword
      if (i !== note.trans.keywords.length - 1) {
        // Separate keywords with comma and non-breaking space.
        // NOTE:  Non-breaking space is used to make Clamp.js (when used) work better - with regular space it
        //        would remove word following the space leaving trailing comma + ellipsis in the end.
        //        With nbsp, last keyword is split.
        keywordsList += ',\xA0';
      }
    }
    return keywordsList;
  };

  $scope.openKeywordsPicker = function() {
    $scope.keywordsPickerOpen = true;
    if (angular.isFunction($scope.registerPropertyEditDoneCallback)) {
      $scope.registerPropertyEditDoneCallback(function() {
        if ($scope.newKeyword.trans.title) {
          $scope.addKeywordToNote($scope.note, $scope.newKeyword);
        }
        $scope.closeKeywordsPicker();
      });
    }
    if (angular.isFunction($scope.registerIsPropertyEdited)) {
      $scope.registerIsPropertyEdited(function() {
        return $scope.newKeyword && $scope.newKeyword.trans.title;
      });
    }
  };

  $scope.closeKeywordsPicker = function() {
    $scope.keywordsPickerOpen = false;
    clearKeyword();
    if (angular.isFunction($scope.unregisterIsPropertyEdited)) $scope.unregisterIsPropertyEdited();
  };

  // Set collapsible open when
  $scope.collapsibleOpen = $scope.editorType === 'recurring';
  $scope.toggleCollapsible = function() {
    $scope.collapsibleOpen = !$scope.collapsibleOpen;
  };

  $scope.hasUnsetCollapsableProperty = function() {
    return !$scope.note.trans.list || (!$scope.note.trans.keywords || !$scope.note.trans.keywords.length);
  };

  $scope.$on('$destroy', function() {
    if (pollForSaveReady) pollForSaveReady.value = false;
  });
}

NoteEditorController['$inject'] = ['$scope', '$timeout',
'NotesService', 'SwiperService', 'TagsService', 'UISessionService'];
angular.module('em.main').controller('NoteEditorController', NoteEditorController);
