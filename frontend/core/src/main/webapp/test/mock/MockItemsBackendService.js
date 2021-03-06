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

 /*global angular, getJSONFixture */
'use strict';

function MockItemsBackendService($httpBackend, ItemsService, PersistentStorageService, SynchronizeService,
                                 UISessionService, UserSessionService, UUIDService) {

  function convertModifiedItemsIntoPersistent(modifiedItems){
    var persistentItems = [];
    for (var i=0; i<modifiedItems.length; i++){
      var persistentItem = {
        uuid: UUIDService.isFakeUUID(modifiedItems[i].trans.uuid) ? UUIDService.randomUUID() :
                                                              modifiedItems[i].trans.uuid,
        title: modifiedItems[i].mod.title || modifiedItems[i].trans.title,
        created: modifiedItems[i].trans.created,
        modified: modifiedItems[i].mod.modified || modifiedItems[i].trans.modified
      };
      if (modifiedItems[i].mod.id) persistentItem.id = modifiedItems[i].mod.id;
      else if (modifiedItems[i].trans.id) persistentItem.id = modifiedItems[i].trans.id;

      if (modifiedItems[i].mod.description) persistentItem.description = modifiedItems[i].mod.description;
      else if (modifiedItems[i].trans.description) persistentItem.description = modifiedItems[i].trans.description;

      if (modifiedItems[i].mod.deleted) persistentItem.deleted = modifiedItems[i].mod.deleted;
      else if (modifiedItems[i].trans.deleted) persistentItem.deleted = modifiedItems[i].trans.deleted;

      if (modifiedItems[i].mod.due) persistentItem.due = modifiedItems[i].mod.due;
      else if (modifiedItems[i].trans.due) persistentItem.due = modifiedItems[i].trans.due;

      if (modifiedItems[i].mod.completed) persistentItem.completed = modifiedItems[i].mod.completed;
      else if (modifiedItems[i].trans.completed) persistentItem.completed = modifiedItems[i].trans.completed;

      if (modifiedItems[i].mod.repeating) persistentItem.repeating = modifiedItems[i].mod.repeating;
      else if (modifiedItems[i].trans.repeating) persistentItem.repeating = modifiedItems[i].trans.repeating;

      if (modifiedItems[i].mod.reminder) persistentItem.reminder = modifiedItems[i].mod.reminder;
      else if (modifiedItems[i].trans.reminder) persistentItem.reminder = modifiedItems[i].trans.reminder;

      if (modifiedItems[i].mod.content) persistentItem.content = modifiedItems[i].mod.content;
      else if (modifiedItems[i].trans.content) persistentItem.content = modifiedItems[i].trans.content;

      if (modifiedItems[i].mod.relationships)
        persistentItem.relationships = modifiedItems[i].mod.relationships;
      else if (modifiedItems[i].relationships)
        persistentItem.relationships = modifiedItems[i].relationships;
      persistentItems.push(persistentItem);
    }
    return persistentItems;
  }

  function mockGetItems(expectResponse){
    $httpBackend.whenGET(SynchronizeService.getItemsRegex)
      .respond(function(method, url, data, headers) {
        if (url.indexOf('?modified=') != -1){
          var modifiedResponse = {};
          var activeUUID = UISessionService.getActiveUUID();
          // Search values that contain mod from the PersistentStorageService and return them
          var modifiedItems = SynchronizeService.getModifiedItems('item', activeUUID);
          if (modifiedItems && modifiedItems.length){
            modifiedResponse.items = convertModifiedItemsIntoPersistent(modifiedItems);
          }
          var modifiedTasks = SynchronizeService.getModifiedItems('task', activeUUID);
          if (modifiedTasks && modifiedTasks.length){
            modifiedResponse.tasks = convertModifiedItemsIntoPersistent(modifiedTasks);
          }
          var modifiedNotes = SynchronizeService.getModifiedItems('note', activeUUID);
          if (modifiedNotes && modifiedNotes.length){
            modifiedResponse.notes = convertModifiedItemsIntoPersistent(modifiedNotes);
          }
          var modifiedLists = SynchronizeService.getModifiedItems('list', activeUUID);
          if (modifiedLists && modifiedLists.length){
            modifiedResponse.lists = convertModifiedItemsIntoPersistent(modifiedLists);
          }
          var modifiedTags = SynchronizeService.getModifiedItems('tag', activeUUID);
          if (modifiedTags && modifiedTags.length){
            modifiedResponse.tags = convertModifiedItemsIntoPersistent(modifiedTags);
          }
          return expectResponse(method, url, data, headers, modifiedResponse);
        }else if (url.indexOf('?completed=true') != -1){
          var response = {
            'tasks': []
          };
          for(var i = 0; i < 100; i++) {
            var referenceDate = new Date();
            if (i < 10 ){
              // First ten are today
            }else if (i < 20){
              // Yesterday
              referenceDate.setDate(referenceDate.getDate()-1);
            }else if (i < 30){
              // Two days ago
              referenceDate.setDate(referenceDate.getDate()-2);
            }else if (i < 40){
              // Week ago
              referenceDate.setDate(referenceDate.getDate()-7);
            }else if (i < 50){
              // Month ago
              referenceDate.setDate(referenceDate.getDate()-31);
            }else if (i < 60){
              // Two months ago
              referenceDate.setDate(referenceDate.getDate()-62);
            }else {
              // Way back
              referenceDate.setDate(referenceDate.getDate()-1000);
            }
            var referenceEpoch = referenceDate.getTime();

            response.tasks.push({
              'uuid': UUIDService.randomUUID(),
              'created': referenceEpoch,
              'modified': referenceEpoch,
              'completed': referenceEpoch + i,
              'title': 'test completed ' + i
            });
          }
          return expectResponse(method, url, data, headers, response);
        }else if (url.indexOf('?archived=true') != -1){
          return expectResponse(method, url, data, headers, {});
        }else if (url.indexOf('?deleted=true') != -1){
          return expectResponse(method, url, data, headers, {});
        }else{
          var authenticateResponse = getJSONFixture('authenticateResponse.json');
          for (var collectiveUUID in authenticateResponse.collectives) {
            if (authenticateResponse.collectives.hasOwnProperty(collectiveUUID)) {
              if (url.indexOf(collectiveUUID) != -1){
                var collectiveItemsResponse = getJSONFixture('collectiveItemsResponse.json');
                return expectResponse(method, url, data, headers, collectiveItemsResponse);
              }
            }
          }

          if (headers.Authorization === 'Basic dG9rZW46VEVTVA=='){
            // Token 'TEST' returned for jp@ext.md
            return expectResponse(method, url, data, headers, {});
          } else if (headers.Authorization === 'Basic dG9rZW46T0ZGTElORQ==') {
            return [404, 'Not found'];
          }
          return expectResponse(method, url, data, headers, getJSONFixture('itemsResponse.json'));
        }
      });
  }

  function mockPutNewItem(expectResponse){
    $httpBackend.whenPUT(ItemsService.putNewItemRegex)
      .respond(function(method, url, data, headers) {
        var putNewItemResponse = getJSONFixture('putItemResponse.json');
        putNewItemResponse.created = putNewItemResponse.modified = (new Date()).getTime();
        putNewItemResponse.uuid = UUIDService.randomUUID();
        return expectResponse(method, url, data, headers, putNewItemResponse);
      });
  }

  function mockPutExistingItem(expectResponse){
    $httpBackend.whenPUT(ItemsService.putExistingItemRegex)
      .respond(function(method, url, data, headers) {
        var putExistingItemResponse = getJSONFixture('putExistingItemResponse.json');
        putExistingItemResponse.modified = (new Date()).getTime();
        return expectResponse(method, url, data, headers, putExistingItemResponse);
      });
  }

  function mockDeleteItem(expectResponse){
    $httpBackend.whenDELETE(ItemsService.deleteItemRegex)
      .respond(function(method, url, data, headers) {
        var deleteItemResponse = getJSONFixture('deleteItemResponse.json');
        deleteItemResponse.result.modified = (new Date()).getTime();
        return expectResponse(method, url, data, headers, deleteItemResponse);
      });
  }

  function mockUndeleteItem(expectResponse){
    $httpBackend.whenPOST(ItemsService.undeleteItemRegex)
      .respond(function(method, url, data, headers) {
        var undeleteItemResponse = getJSONFixture('undeleteItemResponse.json');
        undeleteItemResponse.modified = (new Date()).getTime();
        return expectResponse(method, url, data, headers, undeleteItemResponse);
      });
  }


  return {
    mockItemsBackend: function(expectResponse) {
      mockGetItems(expectResponse);
      mockPutNewItem(expectResponse);
      mockPutExistingItem(expectResponse);
      mockDeleteItem(expectResponse);
      mockUndeleteItem(expectResponse);
    }
  };
}

MockItemsBackendService['$inject'] = ['$httpBackend', 'ItemsService', 'PersistentStorageService',
'SynchronizeService', 'UISessionService', 'UserSessionService', 'UUIDService'];
angular.module('em.appTest').factory('MockItemsBackendService', MockItemsBackendService);
