package org.extendedmind.test

import spray.testkit.ScalatestRouteTest
import org.extendedmind.api.Service
import org.extendedmind.api.JsonImplicits._
import org.extendedmind.SettingsExtension
import scaldi.Module

abstract class SpraySpecBase extends SpecBase 
    with ScalatestRouteTest with Service{

  // Setup implicits to scope
  implicit val rejectionHandler = Service.rejectionHandler
  implicit val exceptionHandler = Service.exceptionHandler

  // spray-testkit
  def actorRefFactory = system

  // Initialize settings correctly here
  def settings = SettingsExtension(system)
  
  // Empty Scaldi bindings
  object EmptyTestConfiguration extends Module

  
  
}