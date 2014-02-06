/*jshint sub:true*/
'use strict';

function NotesController($location, $scope, $timeout, $routeParams, $filter, UserSessionService, OwnerService, NotesService, ListsService, SwiperService, NotesSlidesService) {

  if (!$scope.note){
    if ($location.path().indexOf('/edit/' != -1) || $location.path().indexOf('/new' != -1)){
      if ($routeParams.uuid) {
        $scope.note = NotesService.getNoteByUUID($routeParams.uuid, UserSessionService.getActiveUUID());
      }else {
        $scope.note = {
          relationships: {
            tags: []
          }
        };
        if ($routeParams.parentUUID){
          $scope.note.relationships.parent = $routeParams.parentUUID;
        }
      }
    }
  }

  $scope.saveNote = function(note) {
    NotesService.saveNote(note, UserSessionService.getActiveUUID());
    window.history.back();
  };

  $scope.cancelEdit = function() {
    window.history.back();
  };

  $scope.addNew = function() {
    $location.path($scope.prefix + '/notes/new');
  };

  $scope.editNoteTitle = function(note) {
    NotesService.saveNote(note, UserSessionService.getActiveUUID());
  };

  $scope.editNote = function(note) {
    $location.path(OwnerService.getPrefix() + '/notes/edit/' + note.uuid);
  };

  $scope.deleteNote = function(note) {
    NotesService.deleteNote(note, UserSessionService.getActiveUUID());
  };

  $scope.addNote = function(newNote) {
    var newNoteToSave = {title: newNote.title};
    if (newNote.relationships && newNote.relationships.parent){
      newNoteToSave.relationships = {
        parent: newNote.relationships.parent
      };
    }
    delete newNote.title;

    NotesService.saveNote(newNoteToSave, UserSessionService.getActiveUUID()).then(function(/*newNotToSave*/){
      // TODO: Something with note
    });
  };

  $scope.goToList = function(uuid) {
    SwiperService.swipeTo(NotesSlidesService.LISTS + '/' + uuid);
  };

  $scope.newList = {title: undefined};
  $scope.addList = function(newList) {
    ListsService.saveList(newList, UserSessionService.getActiveUUID()).then(function(/*list*/) {
      // Using timeout 0 to make sure that DOM is ready before refreshing swiper.
      $timeout(function() {
        SwiperService.refreshSwiper(NotesSlidesService.LISTS);
      });
    });
    $scope.newList = {title: undefined};
  };

  $scope.getNoteContentTeaser = function(note) {
    if (note.content){
      var maximumTeaserLength = 80;
      if (note.content.length <= maximumTeaserLength){
        return note.content;
      } else{
        return note.content.substring(0, maximumTeaserLength) + "...";
      }
    }
  }
}

NotesController['$inject'] = ['$location', '$scope', '$timeout', '$routeParams', '$filter',
                              'UserSessionService', 'OwnerService', 'NotesService', 'ListsService',
                              'SwiperService', 'NotesSlidesService'];
angular.module('em.app').controller('NotesController', NotesController);
