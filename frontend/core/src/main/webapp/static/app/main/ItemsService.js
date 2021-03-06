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

 /* global angular*/
 'use strict';

 function ItemsService($q, ArrayService, BackendClientService, ItemLikeService, ListsService, NotesService,
                       TagsService, TasksService, UISessionService, UserSessionService) {

  var itemFieldInfos = ItemLikeService.getFieldInfos();

  var items = {};

  function initializeArrays(ownerUUID) {
    if (!items[ownerUUID]) {
      items[ownerUUID] = {
        activeItems: [],
        deletedItems: []
      };
    }
  }
  UserSessionService.registerNofifyOwnerCallback(initializeArrays, 'ItemsService');

  function updateItem(item, ownerUUID, oldUUID) {
    ItemLikeService.persistAndReset(item, 'item', ownerUUID, itemFieldInfos, oldUUID);
    return ArrayService.updateItem('items', item,
                                   items[ownerUUID].activeItems,
                                   items[ownerUUID].deletedItems);
  }

  function setItem(item, ownerUUID) {
    ItemLikeService.persistAndReset(item, 'item', ownerUUID, itemFieldInfos);
    return ArrayService.setItem('items', item,
                                items[ownerUUID].activeItems,
                                items[ownerUUID].deletedItems);
  }

  function removeActiveItem(activeItemsIndex, ownerUUID) {
    ItemLikeService.remove(items[ownerUUID].activeItems[activeItemsIndex].trans.uuid);
    items[ownerUUID].activeItems.splice(activeItemsIndex, 1);
  }

  return {
    getNewItem: function(initialValues, ownerUUID) {
      return ItemLikeService.getNew(initialValues, 'item', ownerUUID, itemFieldInfos);
    },
    setItems: function(itemsResponse, ownerUUID, skipPersist, addToExisting) {
      if (skipPersist){
        ItemLikeService.resetTrans(itemsResponse, 'item', ownerUUID, itemFieldInfos);
      }else{
        ItemLikeService.persistAndReset(itemsResponse, 'item', ownerUUID, itemFieldInfos);
      }

      if (addToExisting){
        return ArrayService.updateArrays('items', itemsResponse,
                                    items[ownerUUID].activeItems,
                                    items[ownerUUID].deletedItems);
      }else{
        return ArrayService.setArrays('items', itemsResponse,
                                    items[ownerUUID].activeItems,
                                    items[ownerUUID].deletedItems);
      }
    },
    updateItems: function(itemsResponse, ownerUUID) {
      if (itemsResponse && itemsResponse.length){
        // Go through itemsResponse, and add .mod values if the fields in the current .mod do not match
        // the values in the persistent response
        var updatedItems = [];
        for (var i=0; i<itemsResponse.length; i++){
          var itemInfo = this.getItemInfo(itemsResponse[i].uuid, ownerUUID);
          if (itemInfo){
            ItemLikeService.evaluateMod(itemsResponse[i], itemInfo.item, 'item', ownerUUID, itemFieldInfos);
            updatedItems.push(itemInfo.item);
          }else{
            updatedItems.push(itemsResponse[i]);
          }
        }
        ItemLikeService.persistAndReset(updatedItems, 'item', ownerUUID, itemFieldInfos);
        return ArrayService.updateArrays('items', updatedItems,
                                         items[ownerUUID].activeItems,
                                         items[ownerUUID].deletedItems);
      }
    },
    updateItemModProperties: function(uuid, properties, ownerUUID) {
      var itemInfo = this.getItemInfo(uuid, ownerUUID);
      if (itemInfo){
        if (!properties){
          if (itemInfo.item.mod){
            delete itemInfo.item.mod;
            updateItem(itemInfo.item, ownerUUID);
          }
        }else{
          if (!itemInfo.item.mod) itemInfo.item.mod = {};
          ItemLikeService.updateObjectProperties(itemInfo.item.mod, properties);
          updateItem(itemInfo.item, ownerUUID, properties.uuid ? uuid : undefined);
        }
        return itemInfo.item;
      }
    },
    getItems: function(ownerUUID) {
      return items[ownerUUID].activeItems;
    },
    getModifiedItems: function(ownerUUID) {
      return ArrayService.getModifiedItems(items[ownerUUID].activeItems,
                                         items[ownerUUID].deletedItems);
    },
    getItemInfo: function(value, ownerUUID, searchField) {
      var field = searchField ? searchField : 'uuid';
      var item = items[ownerUUID].activeItems.findFirstObjectByKeyValue(field, value, 'trans');
      if (item){
        return {
          type: 'active',
          item: item
        };
      }
      item = items[ownerUUID].deletedItems.findFirstObjectByKeyValue(field, value, 'trans');
      if (item){
        return {
          type: 'deleted',
          item: item
        };
      }
    },
    getDeletedItems: function(ownerUUID) {
      return items[ownerUUID].deletedItems;
    },
    saveItem: function(item, ownerUUID) {
      var deferred = $q.defer();
      if (items[ownerUUID].deletedItems.findFirstObjectByKeyValue('uuid', item.trans.uuid, 'trans')) {
        deferred.reject({type: 'deleted'});
      } else {
        ItemLikeService.save(item, 'item', ownerUUID, itemFieldInfos).then(
          function(result){
            if (result === 'new') setItem(item, ownerUUID);
            else if (result === 'existing') updateItem(item, ownerUUID);
            deferred.resolve(result);
          }, function(failure){
            deferred.reject(failure);
          }
        );
      }
      return deferred.promise;
    },
    isItemEdited: function(item, ownerUUID) {
      return ItemLikeService.isEdited(item, 'item', ownerUUID, itemFieldInfos);
    },
    resetItem: function(item, ownerUUID) {
      return ItemLikeService.resetTrans(item, 'item', ownerUUID, itemFieldInfos);
    },
    deleteItem: function(item, ownerUUID) {
      var deferred = $q.defer();
      // Check if item has already been deleted
      if (items[ownerUUID].deletedItems.findFirstObjectByKeyValue('uuid', item.trans.uuid, 'trans')) {
        deferred.resolve('unmodified');
      }else{
        ItemLikeService.processDelete(item, 'item', ownerUUID, itemFieldInfos).then(
          function(){
            updateItem(item, ownerUUID);
            deferred.resolve(item);
          }, function(failure){
            deferred.reject(failure);
          }
        );
      }
      return deferred.promise;
    },
    undeleteItem: function(item, ownerUUID) {
      var deferred = $q.defer();
      // Check that item is deleted before trying to undelete
      if (!items[ownerUUID].deletedItems.findFirstObjectByKeyValue('uuid', item.trans.uuid, 'trans')) {
        deferred.resolve('unmodified');
      }else{
        ItemLikeService.undelete(item, 'item', ownerUUID, itemFieldInfos).then(
          function(){
            updateItem(item, ownerUUID);
            deferred.resolve(item);
          }, function(failure){
            deferred.reject(failure);
          }
        );
      }
      return deferred.promise;
    },
    removeItem: function(uuid, ownerUUID) {
      var itemInfo = this.getItemInfo(uuid, ownerUUID);
      if (itemInfo) {
        var itemIndex;
        if (itemInfo.type === 'active') {
          itemIndex = items[ownerUUID].activeItems.indexOf(itemInfo.item);
          removeActiveItem(itemIndex, ownerUUID);
        } else if (itemInfo.type === 'deleted') {
          itemIndex = items[ownerUUID].deletedItems.indexOf(itemInfo.item);
          ItemLikeService.remove(itemInfo.item.trans.uuid);
          items[ownerUUID].deletedItems.splice(itemIndex, 1);
        }
      }
    },
    itemToTask: function(item, ownerUUID) {
      var deferred = $q.defer();
      if (items[ownerUUID].deletedItems.findFirstObjectByKeyValue('uuid', item.trans.uuid, 'trans')) {
        deferred.reject({type: 'deleted'});
      } else {
        var index = items[ownerUUID].activeItems.findFirstIndexByKeyValue('uuid', item.trans.uuid, 'trans');
        TasksService.saveTask(items[ownerUUID].activeItems[index],
                              ownerUUID).then(function(/*result*/){
          removeActiveItem(index, ownerUUID);
          deferred.resolve(item);
        },function(failure){
          deferred.reject(failure);
        });
      }
      return deferred.promise;
    },
    itemToNote: function(item, ownerUUID) {
      var deferred = $q.defer();
      if (items[ownerUUID].deletedItems.findFirstObjectByKeyValue('uuid', item.trans.uuid, 'trans')) {
        deferred.reject({type: 'deleted'});
      } else {
        var index = items[ownerUUID].activeItems.findFirstIndexByKeyValue('uuid', item.trans.uuid, 'trans');
        NotesService.saveNote(items[ownerUUID].activeItems[index],
                              ownerUUID).then(function(/*result*/){
          removeActiveItem(index, ownerUUID);
          deferred.resolve(item);
        },function(failure){
          deferred.reject(failure);
        });
      }
      return deferred.promise;
    },
    itemToList: function(item, ownerUUID) {
      var deferred = $q.defer();
      if (items[ownerUUID].deletedItems.findFirstObjectByKeyValue('uuid', item.trans.uuid, 'trans')) {
        deferred.reject({type: 'deleted'});
      } else {
        var index = items[ownerUUID].activeItems.findFirstIndexByKeyValue('uuid', item.trans.uuid, 'trans');
        ListsService.saveList(items[ownerUUID].activeItems[index],
                              ownerUUID).then(function(/*result*/){
          removeActiveItem(index, ownerUUID);
          deferred.resolve(item);
        },function(failure){
          deferred.reject(failure);
        });
      }
      return deferred.promise;
    },
    clearItems: function() {
      items = {};
    },
    changeOwnerUUID: function(oldUUID, newUUID){
      if (items[oldUUID]){
        items[newUUID] = items[oldUUID];
        delete items[oldUUID];
        ItemLikeService.persistAndReset(items[newUUID].activeItems, 'item', newUUID, itemFieldInfos);
        ItemLikeService.persistAndReset(items[newUUID].deletedItems, 'item', newUUID, itemFieldInfos);
      }
    },
    // Regular expressions for item requests
    putNewItemRegex: ItemLikeService.getPutNewRegex('item'),
    putExistingItemRegex: ItemLikeService.getPutExistingRegex('item'),
    deleteItemRegex: ItemLikeService.getDeleteRegex('item'),
    undeleteItemRegex: ItemLikeService.getUndeleteRegex('item')
  };
}

ItemsService['$inject'] = ['$q', 'ArrayService', 'BackendClientService', 'ItemLikeService', 'ListsService',
  'NotesService', 'TagsService', 'TasksService', 'UISessionService', 'UserSessionService'];
angular.module('em.main').factory('ItemsService', ItemsService);
