/**
 * Copyright (c) 2013-2014 Extended Mind Technologies Oy
 *
 * This file is part of Extended Mind.
 *
 * Extended Mind is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

package org.extendedmind.db

import java.util.UUID
import scala.collection.JavaConversions.iterableAsScalaIterable
import org.extendedmind.Response._
import org.extendedmind._
import org.extendedmind.domain._
import org.neo4j.graphdb.Direction
import org.neo4j.graphdb.DynamicRelationshipType
import org.neo4j.graphdb.Node
import org.neo4j.graphdb.traversal.Evaluators
import org.neo4j.graphdb.traversal.TraversalDescription
import org.neo4j.kernel.Traversal
import org.neo4j.scala.DatabaseService
import scala.collection.mutable.ListBuffer

trait NoteDatabase extends AbstractGraphDatabase with ItemDatabase {

  // PUBLIC

  def putNewNote(owner: Owner, note: Note): Response[SetResult] = {
    for {
      noteNode <- putNewExtendedItem(owner, note, ItemLabel.NOTE).right
      result <- Right(getSetResult(noteNode, true)).right
      unit <- Right(addToItemsIndex(owner, noteNode, result)).right
    } yield result
  }

  def putExistingNote(owner: Owner, noteUUID: UUID, note: Note): Response[SetResult] = {
    for {
      noteNode <- putExistingExtendedItem(owner, noteUUID, note, ItemLabel.NOTE).right
      result <- Right(getSetResult(noteNode, false)).right
      unit <- Right(updateItemsIndex(noteNode, result)).right
    } yield result
  }

  def getNote(owner: Owner, noteUUID: UUID): Response[Note] = {
    withTx {
      implicit neo =>
        for {
          noteNode <- getItemNode(owner, noteUUID, Some(ItemLabel.NOTE)).right
          note <- toNote(noteNode, owner).right
        } yield note
    }
  }
  
  def deleteNote(owner: Owner, noteUUID: UUID): Response[DeleteItemResult] = {
    for {
      deletedNoteNode <- deleteNoteNode(owner, noteUUID).right
      result <- Right(getDeleteItemResult(deletedNoteNode._1, deletedNoteNode._2)).right
      unit <- Right(updateItemsIndex(deletedNoteNode._1, result.result)).right
    } yield result
  }
  
  def favoriteNote(owner: Owner, noteUUID: UUID): Response[FavoriteNoteResult] = {
    for {
      favoriteInfo <- favoriteNoteNode(owner, noteUUID).right
      result <- Right(FavoriteNoteResult(favoriteInfo._2, getSetResult(favoriteInfo._1, false))).right
      unit <- Right(updateItemsIndex(favoriteInfo._1, result.result)).right
    } yield result
  }
  
  def unfavoriteNote(owner: Owner, noteUUID: UUID): Response[SetResult] = {
    for {
      noteNode <- unfavoriteNoteNode(owner, noteUUID).right
      result <- Right(getSetResult(noteNode, false)).right
      unit <- Right(updateItemsIndex(noteNode, result)).right
    } yield result
  }
  
  def noteToTask(owner: Owner, noteUUID: UUID, note: Note): Response[Task] = {
    for {
      convertResult <- convertNoteToTask(owner, noteUUID, note).right
      result <- Right(getSetResult(convertResult._1, false)).right
      unit <- Right(updateItemsIndex(convertResult._1, result)).right
    } yield convertResult._2
  }
  
  def noteToList(owner: Owner, noteUUID: UUID, note: Note): Response[List] = {
    for {
      convertResult <- convertNoteToList(owner, noteUUID, note).right
      result <- Right(getSetResult(convertResult._1, false)).right
      unit <- Right(updateItemsIndex(convertResult._1, result)).right
    } yield convertResult._2
  }

  // PRIVATE

  override def toNote(noteNode: Node, owner: Owner)
               (implicit neo4j: DatabaseService): Response[Note] = {
    for {
      note <- toCaseClass[Note](noteNode).right
      completeNote <- addTransientNoteProperties(noteNode, owner, note).right
    } yield completeNote
  }

  protected def addTransientNoteProperties(noteNode: Node, owner: Owner, note: Note)
                (implicit neo4j: DatabaseService): Response[Note] = {
    for {
      parent <- getItemRelationship(noteNode, owner, ItemRelationship.HAS_PARENT, ItemLabel.LIST).right
      tags <- getTagRelationships(noteNode, owner).right
      note <- Right(note.copy(
        relationships = 
          (if (parent.isDefined || tags.isDefined)            
            Some(ExtendedItemRelationships(  
              parent = (if (parent.isEmpty) None else (Some(getUUID(parent.get.getEndNode())))),
              None,
              tags = (if (tags.isEmpty) None else (Some(getEndNodeUUIDList(tags.get))))))
           else None
          ))).right
    } yield note
  }

  
  protected def deleteNoteNode(owner: Owner, noteUUID: UUID): Response[Tuple2[Node, Long]] = {
    withTx {
      implicit neo =>
        for {
          itemNode <- getItemNode(owner, noteUUID, Some(ItemLabel.NOTE)).right
          deleted <- Right(deleteItem(itemNode)).right
        } yield (itemNode, deleted)
    }
  }
  
  protected def favoriteNoteNode(owner: Owner, noteUUID: UUID): Response[(Node, Long)] = {
    withTx {
      implicit neo4j =>
        for {
          noteNode <- getItemNode(owner, noteUUID, Some(ItemLabel.NOTE)).right
          favorited <- Right(favoriteNoteNode(noteNode)).right
        } yield (noteNode, favorited)
    }
  }
  
  protected def favoriteNoteNode(noteNode: Node)(implicit neo4j: DatabaseService): Long = {
    val currentTime = System.currentTimeMillis()
    noteNode.setProperty("favorited", currentTime)
    currentTime
  }
  
  protected def unfavoriteNoteNode(owner: Owner, noteUUID: UUID): Response[Node] = {
    withTx {
      implicit neo =>
        for {
          noteNode <- getItemNode(owner, noteUUID, Some(ItemLabel.NOTE)).right
          result <- Right(unfavoriteNoteNode(noteNode)).right
        } yield noteNode
    }
  }

  protected def unfavoriteNoteNode(noteNode: Node)(implicit neo4j: DatabaseService): Unit = {
    if (noteNode.hasProperty("favorited")) noteNode.removeProperty("favorited")
  }

  protected def convertNoteToTask(owner: Owner, noteUUID: UUID, note: Note): Response[(Node, Task)] = {
    withTx {
      implicit neo4j =>
        for {
          noteNode <- putExistingExtendedItem(owner, noteUUID, note, ItemLabel.NOTE).right
          taskNode <- Right(setLabel(noteNode, Some(MainLabel.ITEM), Some(ItemLabel.TASK), Some(scala.List(ItemLabel.NOTE)))).right
          result <- moveContentToDescription(taskNode).right
          task <- toTask(taskNode, owner).right
        } yield (taskNode, task)
    }
  }
  
  protected def convertNoteToList(owner: Owner, noteUUID: UUID, note: Note): Response[(Node, List)] = {
    withTx {
      implicit neo4j =>
        for {
          noteNode <- putExistingExtendedItem(owner, noteUUID, note, ItemLabel.NOTE).right
          listNode <- Right(setLabel(noteNode, Some(MainLabel.ITEM), Some(ItemLabel.LIST), Some(scala.List(ItemLabel.NOTE)))).right
          result <- moveContentToDescription(listNode).right
          list <- toList(listNode, owner).right
        } yield (listNode, list)
    }
  }
}