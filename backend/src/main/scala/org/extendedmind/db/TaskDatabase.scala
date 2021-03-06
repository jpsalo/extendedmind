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
import org.neo4j.graphdb.Relationship

trait TaskDatabase extends AbstractGraphDatabase with ItemDatabase {

  // PUBLIC

  def putNewTask(owner: Owner, task: Task, originTaskNode: Option[Node] = None): Response[SetResult] = {
    for {
      taskNode <- putNewTaskNode(owner, task, originTaskNode).right
      result <- Right(getSetResult(taskNode, true)).right
      unit <- Right(addToItemsIndex(owner, taskNode, result)).right
    } yield result
  }

  def putExistingTask(owner: Owner, taskUUID: UUID, task: Task): Response[SetResult] = {
    for {
      taskNode <- putExistingTaskNode(owner, taskUUID, task).right
      result <- Right(getSetResult(taskNode, false)).right
      unit <- Right(updateItemsIndex(taskNode, result)).right
    } yield result
  }

  def getTask(owner: Owner, taskUUID: UUID): Response[Task] = {
    withTx {
      implicit neo =>
        for {
          taskNode <- getItemNode(owner, taskUUID, Some(ItemLabel.TASK)).right
          task <- toCaseClass[Task](taskNode).right
          completeTask <- addTransientTaskProperties(taskNode, owner, task).right
        } yield completeTask
    }
  }
  
  def deleteTask(owner: Owner, taskUUID: UUID): Response[DeleteItemResult] = {
    for {
      deletedTaskNode <- deleteTaskNode(owner, taskUUID).right
      result <- Right(getDeleteItemResult(deletedTaskNode._1, deletedTaskNode._2)).right
      unit <- Right(updateItemsIndex(deletedTaskNode._1, result.result)).right
    } yield result
  }
  
  def completeTask(owner: Owner, taskUUID: UUID): Response[CompleteTaskResult] = {
    for {
      completeInfo <- completeTaskNode(owner, taskUUID).right
      result <- Right(getCompleteTaskResult(completeInfo)).right
      unit <- Right(updateItemsIndex(completeInfo._1, result.result)).right
    } yield result
  }
  
  def uncompleteTask(owner: Owner, taskUUID: UUID): Response[SetResult] = {
    for {
      taskNode <- uncompleteTaskNode(owner, taskUUID).right
      result <- Right(getSetResult(taskNode, false)).right
      unit <- Right(updateItemsIndex(taskNode, result)).right
    } yield result
  }
  
  def taskToList(owner: Owner, taskUUID: UUID, task: Task): Response[List] = {
    for {
      convertResult <- convertTaskToList(owner, taskUUID, task).right
      result <- Right(getSetResult(convertResult._1, false)).right
      unit <- Right(updateItemsIndex(convertResult._1, result)).right
    } yield convertResult._2
  }
  
  def taskToNote(owner: Owner, taskUUID: UUID, task: Task): Response[Note] = {
    for {
      convertResult <- convertTaskToNote(owner, taskUUID, task).right
      result <- Right(getSetResult(convertResult._1, false)).right
      unit <- Right(updateItemsIndex(convertResult._1, result)).right
    } yield convertResult._2
  }

  // PRIVATE

  protected def putNewTaskNode(owner: Owner, task: Task, originTaskNode: Option[Node] = None): Response[Node] = {
    withTx {
      implicit neo4j =>
        for {
          taskNode <- putNewExtendedItem(owner, task, ItemLabel.TASK).right
          relationship <- setTaskOriginRelationship(taskNode, originTaskNode).right
          unit <- updateReminders(taskNode, task.reminders).right
        } yield taskNode
    }
  }

  protected def putExistingTaskNode(owner: Owner, taskUUID: UUID, task: Task): Response[Node] = {
    withTx {
      implicit neo4j =>
        for {
          taskNode <- putExistingExtendedItem(owner, taskUUID, task, ItemLabel.TASK).right
          unit <- updateReminders(taskNode, task.reminders).right
        } yield taskNode
    }
  }

  override def toTask(taskNode: Node, owner: Owner)(implicit neo4j: DatabaseService): Response[Task] = {
    for {
      task <- toCaseClass[Task](taskNode).right
      completeTask <- addTransientTaskProperties(taskNode, owner, task).right
    } yield completeTask
  }

  protected def addTransientTaskProperties(taskNode: Node, owner: Owner, task: Task)(implicit neo4j: DatabaseService): Response[Task] = {
    for {
      parent <- getItemRelationship(taskNode, owner, ItemRelationship.HAS_PARENT, ItemLabel.LIST).right
      origin <- getItemRelationship(taskNode, owner, ItemRelationship.HAS_ORIGIN, ItemLabel.TASK).right
      tags <- getTagRelationships(taskNode, owner).right
      reminderNodes <- Right(getReminderNodes(taskNode)).right
      reminders <- getReminders(reminderNodes).right
      task <- Right(task.copy(
        reminders = reminders,
        relationships = 
          (if (parent.isDefined || origin.isDefined || tags.isDefined )            
            Some(ExtendedItemRelationships(
              parent = (if (parent.isEmpty) None else (Some(getUUID(parent.get.getEndNode())))),
              origin = (if (origin.isEmpty) None else (Some(getUUID(origin.get.getEndNode())))),
              tags = (if (tags.isEmpty) None else (Some(getEndNodeUUIDList(tags.get))))))
           else None
          ))).right
    } yield task
  }

  protected def completeTaskNode(owner: Owner, taskUUID: UUID): Response[(Node, Long, Option[Task])] = {
    for {
      completeInfo <- markTaskNodeComplete(owner, taskUUID).right
      generatedTask <- evaluateRepeating(owner, completeInfo._1).right
      fullGeneratedTask <- putGeneratedTask(owner, generatedTask, completeInfo._1).right
    } yield (completeInfo._1, completeInfo._2, fullGeneratedTask)
  }
  
  protected def markTaskNodeComplete(owner: Owner, taskUUID: UUID): Response[(Node, Long)] = {
    withTx {
      implicit neo =>
        for {
          taskNode <- getItemNode(owner, taskUUID, Some(ItemLabel.TASK)).right
          completed <- markTaskNodeComplete(owner, taskNode).right
        } yield (taskNode, completed)
    }
  }    
  
  protected def markTaskNodeComplete(owner: Owner, taskNode: Node)(implicit neo4j: DatabaseService): Response[Long] = {
    withTx {
      implicit neo4j =>
  	    val currentTime = System.currentTimeMillis()
  	    taskNode.setProperty("completed", currentTime)
  	    Right(currentTime)
    }
  }

  protected def evaluateRepeating(owner: Owner, taskNode: Node): Response[Option[Task]] = {
    withTx {
      implicit neo =>
        if (taskNode.hasProperty("repeating")) {
          // Generate new task on complete if a new task has not already been created
          val originRelationshipResponse = getItemRelationship(taskNode, owner, ItemRelationship.HAS_ORIGIN, ItemLabel.TASK, Direction.INCOMING)
          if (originRelationshipResponse.isLeft) Left(originRelationshipResponse.left.get)
          else if (originRelationshipResponse.right.get.isEmpty){
	          // First, get new due string
	          val repeatingType = RepeatingType.withName(taskNode.getProperty("repeating").asInstanceOf[String])
	          val oldDue: java.util.Calendar = java.util.Calendar.getInstance();
	          oldDue.setTime(Validators.dateFormat.parse(taskNode.getProperty("due").asInstanceOf[String]))
	          val newDue = repeatingType match {
	            case RepeatingType.DAILY => oldDue.add(java.util.Calendar.DATE, 1)
	            case RepeatingType.WEEKLY => oldDue.add(java.util.Calendar.DATE, 7)
	            case RepeatingType.BIWEEKLY => oldDue.add(java.util.Calendar.DATE, 14)
	            case RepeatingType.MONTHLY => oldDue.add(java.util.Calendar.MONTH, 1)
	            case RepeatingType.BIMONTHLY => oldDue.add(java.util.Calendar.MONTH, 2)
	            case RepeatingType.YEARLY => oldDue.add(java.util.Calendar.YEAR, 1)
	          }
	          val newDueString = Validators.dateFormat.format(oldDue.getTime())
	
	          // Second, duplicate old task
	          val oldTask = for {
	            task <- toCaseClass[Task](taskNode).right
	            completeTask <- addTransientTaskProperties(taskNode, owner, task).right
	          } yield completeTask
	          if (oldTask.isLeft) Left(oldTask.left.get)
	          else {
	            Right(Some(oldTask.right.get.copy(uuid = None, modified = None, due = Some(newDueString))))
	          }
          }
          else{
            // A new task has already been created
            Right(None)
          }
        } else {
          // Not a repeating task
          Right(None)
        }
    }
  }
  
  protected def putGeneratedTask(owner: Owner, task: Option[Task], originTaskNode: Node): Response[Option[Task]] = {
    if (task.isDefined){
      val putTaskResponse = putNewTask(owner, task.get, Some(originTaskNode))
      if (putTaskResponse.isLeft) Left(putTaskResponse.left.get)
      else {
        val getTaskResponse = getTask(owner, putTaskResponse.right.get.uuid.get)
        if (getTaskResponse.isLeft) Left(getTaskResponse.left.get)
        else Right(Some(getTaskResponse.right.get))
      }
    }
    else{
      Right(None)
    }
  }
  
  protected def setTaskOriginRelationship(taskNode: Node, originTaskNode: Option[Node])(implicit neo4j: DatabaseService): Response[Option[Relationship]] = {
    if (originTaskNode.isDefined){
      val relationship = taskNode --> ItemRelationship.HAS_ORIGIN --> originTaskNode.get <;
      Right(Some(relationship))
    }else{
      Right(None)
    }
  }
  
  protected def getReminderNodes(taskNode: Node)(implicit neo4j: DatabaseService): scala.List[Node] = {
    val reminderTraversal = neo4j.gds.traversalDescription()
      .breadthFirst()
      .relationships(DynamicRelationshipType.withName(ItemRelationship.HAS_REMINDER.name), Direction.OUTGOING)
      .evaluator(Evaluators.excludeStartPosition())
      .evaluator(LabelEvaluator(scala.List(MainLabel.REMINDER)))
      .evaluator(Evaluators.toDepth(1))
      .traverse(taskNode)
    reminderTraversal.nodes().toList
  }
  
  protected def getReminders(reminderNodes: scala.List[Node])(implicit neo4j: DatabaseService): Response[Option[scala.List[Reminder]]] = {
    if (reminderNodes.isEmpty){
      Right(None)
    }else{
      Right(Some(reminderNodes.map(reminderNode => {
        val convertResponse = toCaseClass[Reminder](reminderNode)
        if (convertResponse.isLeft) return Left(convertResponse.left.get)
        convertResponse.right.get
      })))
    }
  }
  
  protected def updateReminders(taskNode: Node, reminders: Option[scala.List[Reminder]])(implicit neo4j: DatabaseService): Response[Unit] = {    
    val reminderNodeList = getReminderNodes(taskNode)
    
    if (reminders.isEmpty || reminders.get.size == 0){
      reminderNodeList.foreach(reminderNode => {
        destroyReminder(reminderNode)
      })
    }else{
      // Loop over new list
      reminders.get.foreach(reminder => {
        if (reminder.uuid.isEmpty){
          // New reminder
          createReminder(taskNode, reminder)
        }else{
          // existing reminder
          val existingReminder = reminderNodeList.find(reminderNode => {
            getUUID(reminderNode) == reminder.uuid.get
          })
          if (existingReminder.isEmpty){
            return fail(INVALID_PARAMETER, ERR_TASK_INVALID_REMINDER_UUID, "Could not find reminder with UUID " + reminder.uuid.get)
          }
          updateNode(existingReminder.get, reminder).right
        }
      })
      
      // Loop over existing reminders and delete non-existent reminders
      reminderNodeList.foreach(reminderNode => {
        if (reminders.get.find(reminder => {
          reminder.uuid.isDefined && (reminder.uuid.get == getUUID(reminderNode))
        }).isEmpty){
          destroyReminder(reminderNode)        
        }
      })
    }
    Right(Unit)
  }

  protected def createReminder(taskNode: Node, reminder: Reminder)(implicit neo4j: DatabaseService): Node = {
    val reminderNode = createNode(reminder, MainLabel.REMINDER)
    taskNode --> ItemRelationship.HAS_REMINDER --> reminderNode;
    reminderNode
  }

  
  protected def destroyReminder(reminderNode: Node)(implicit neo4j: DatabaseService) {
    // Remove all relationships
    val relationShipList = reminderNode.getRelationships().toList
    relationShipList.foreach(relationship => relationship.delete())
    // Delete reminder itself
    reminderNode.delete()
  }

  protected def getCompleteTaskResult(completeInfo: (Node, Long, Option[Task])): CompleteTaskResult = {
    CompleteTaskResult(completeInfo._2,
      getSetResult(completeInfo._1, false),
      completeInfo._3)
  }
  
  protected def uncompleteTaskNode(owner: Owner, taskUUID: UUID): Response[Node] = {
    withTx {
      implicit neo =>
        for {
          taskNode <- getItemNode(owner, taskUUID, Some(ItemLabel.TASK)).right
          result <- Right(uncompleteTaskNode(taskNode)).right
        } yield taskNode
    }
  }

  protected def uncompleteTaskNode(taskNode: Node)(implicit neo4j: DatabaseService): Unit = {
    if (taskNode.hasProperty("completed")) taskNode.removeProperty("completed")
  }

  protected def deleteTaskNode(owner: Owner, taskUUID: UUID): Response[Tuple2[Node, Long]] = {
    withTx {
      implicit neo =>
        for {
          itemNode <- getItemNode(owner, taskUUID, Some(ItemLabel.TASK)).right
          deleted <- Right(deleteItem(itemNode)).right
        } yield (itemNode, deleted)
    }
  }
  
  protected def convertTaskToList(owner: Owner, taskUUID: UUID, task: Task): Response[(Node, List)] = {
    withTx {
      implicit neo4j =>
        for {
          taskNode <- putExistingExtendedItem(owner, taskUUID, task, ItemLabel.TASK).right
          listNode <- Right(setLabel(taskNode, Some(MainLabel.ITEM), Some(ItemLabel.LIST), Some(scala.List(ItemLabel.TASK)))).right
          list <- toList(listNode, owner).right
        } yield (taskNode, list)
    }
  }
  
  protected def convertTaskToNote(owner: Owner, taskUUID: UUID, task: Task): Response[(Node, Note)] = {
    withTx {
      implicit neo4j =>
        for {
          taskNode <- putExistingExtendedItem(owner, taskUUID, task, ItemLabel.TASK).right
          noteNode <- Right(setLabel(taskNode, Some(MainLabel.ITEM), Some(ItemLabel.NOTE), Some(scala.List(ItemLabel.TASK)))).right
          result <- Right(moveDescriptionToContent(noteNode)).right
          note <- toNote(noteNode, owner).right
        } yield (taskNode, note)
    }
  }

}