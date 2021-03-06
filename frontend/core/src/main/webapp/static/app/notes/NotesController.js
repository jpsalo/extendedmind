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

 function NotesController($q, $rootScope, $scope, $timeout,
                          AnalyticsService, BackendClientService, ItemsService, ListsService, NotesService,
                          TagsService, SwiperService, UISessionService) {

  $scope.getNewNote = function(initialValues){
    return NotesService.getNewNote(initialValues, UISessionService.getActiveUUID());
  };

  $scope.getNewFavoriteNote = function(){
    var newNote = NotesService.getNewNote({favorited: BackendClientService.generateFakeTimestamp()},
                                          UISessionService.getActiveUUID());
    return newNote;
  };

  $scope.noteHasKeywords = function noteHasKeywords(note) {
    return note.trans.keywords && note.trans.keywords.length;
  };

  // Return keywords, that has beend added during note edit.
  function getNewKeywords(keywords) {
    var newKeywords = [];
    for (var i=0; i<keywords.length; i++){
      var keyword = keywords[i];
      if (!keyword.trans.uuid) {
        // Keyword is new when it doesn't have an UUID.
        newKeywords.push(keyword);
      }
    }
    return newKeywords;
  }

  // Save keywords first because saveTag requires network connection.
  function saveKeywords(note) {
    if ($scope.noteHasKeywords(note)) {
      // http://stackoverflow.com/a/21315112
      var newKeywords = getNewKeywords(note.trans.keywords);
      if (newKeywords) {
        var saveNewKeywordPromises = newKeywords.map(function(newKeyword) {
          // Make array of save keyword promises from new keywords.
          return TagsService.saveTag(newKeyword, UISessionService.getActiveUUID());
        });

        return $q.all(saveNewKeywordPromises);
      }
    }

    // Return promise to caller.
    var deferredSaveKeywords = $q.defer();
    deferredSaveKeywords.resolve();
    return deferredSaveKeywords.promise;
  }

  // SAVING

  $scope.saveNote = function saveNote(note, pollForSaveReady) {
    if (note.trans.uuid) AnalyticsService.do('saveNote');
    else AnalyticsService.do('addNote');
    return saveKeywords(note).then(function() {
      var favoriteBeforeSave = note.trans.favorited;
      return NotesService.saveNote(note, UISessionService.getActiveUUID(), pollForSaveReady)
      .then(function(result){
        if (result === 'new' && favoriteBeforeSave){
          return $scope.favoriteNote(note);
        }
        return result;
      });
    });
  };

  // (UN)DELETING

  $scope.deleteNote = function deleteNote(note) {
    if (note.trans.uuid) {
      AnalyticsService.do('deleteNote');
      NotesService.deleteNote(note, UISessionService.getActiveUUID());
    }
  };

  $scope.undeleteNote = function(note) {
    if (note.trans.uuid){
      AnalyticsService.do('undeleteNote');
      NotesService.undeleteNote(note, UISessionService.getActiveUUID());
    }
  };

  $scope.getNoteContentTeaser = function getNoteContentTeaser(note) {
    if (note.trans.content) {
      var maximumTeaserLength = 300;
      if (note.trans.content.length <= maximumTeaserLength) {
        return note.trans.content;
      } else {
        return note.trans.content.substring(0, maximumTeaserLength);
      }
    }
  };

  /*
  * Favorite note.
  */
  $scope.favoriteNote = function(note) {
    if (note.trans.uuid && note.trans.itemType === 'note') {
      AnalyticsService.do('favoriteNote');
      return NotesService.favoriteNote(note, UISessionService.getActiveUUID());
    } else {
      note.trans.favorited = BackendClientService.generateFakeTimestamp();
    }
  };

  /*
  * Unfavorite note.
  */
  $scope.unfavoriteNote = function(note) {
    if (note.trans.uuid && note.trans.itemType === 'note') {
      AnalyticsService.do('unfavoriteNote');
      return NotesService.unfavoriteNote(note, UISessionService.getActiveUUID());
    } else {
      delete note.trans.favorited;
    }
  };

  $scope.openNoteEditor = function(note){
    return $scope.openEditor('note', note/*, 'fullScreen'*/);
  };

  $scope.openNoteEditorView = function(note){
    // TODO: Use mode 'view' here when view mode is implemented!
    return $scope.openEditor('note', note/*, 'fullScreen'*/);
  };

}

NotesController['$inject'] = ['$q', '$rootScope', '$scope', '$timeout',
'AnalyticsService', 'BackendClientService', 'ItemsService', 'ListsService', 'NotesService', 'TagsService',
'SwiperService', 'UISessionService'
];
angular.module('em.notes').controller('NotesController', NotesController);
