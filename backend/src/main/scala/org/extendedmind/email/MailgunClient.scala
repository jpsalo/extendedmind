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

package org.extendedmind.email

import scala.util.{ Success, Failure }
import org.extendedmind.domain._
import org.extendedmind._
import org.extendedmind.Response._
import scaldi._
import akka.actor.ActorSystem
import akka.io.IO
import akka.pattern.ask
import spray.http._
import MediaTypes._
import spray.client.pipelining._
import spray.json._
import spray.httpx.SprayJsonSupport._
import spray.httpx.marshalling._
import spray.httpx.marshalling.Marshaller._
import spray.json.DefaultJsonProtocol._
import spray.util.LoggingContext
import scala.concurrent.Future
import akka.util.Timeout
import scala.concurrent.duration._
import scala.concurrent.Await
import scala.concurrent.ExecutionContext
import akka.actor.ActorRefFactory
import java.util.UUID

case class SendEmailRequest(from: String, to: String, subject: String, html: String)
case class SendEmailResponse(message: String, id: String)

object MailgunProtocol extends DefaultJsonProtocol {
  implicit val sendEmailRequestMarshaller =
    Marshaller.delegate[SendEmailRequest, FormData](`application/x-www-form-urlencoded`) { (sendEmailRequest, contentType) =>
      new FormData(getCCParams(sendEmailRequest).map { case (k, v) => (k, v) } toList)
    }
  implicit val sendEmailResponseFormat = jsonFormat2(SendEmailResponse)

  def getCCParams(cc: AnyRef): Map[String, String] =
    (Map[String, String]() /: cc.getClass.getDeclaredFields) { (a, f) =>
      f.setAccessible(true)
      a + (f.getName -> f.get(cc).asInstanceOf[String])
    }
}

trait MailgunClient {

  import MailgunProtocol._

  def settings: Settings
  def actorRefFactory: ActorRefFactory

  val inviteHtmlTemplate = getTemplate("invite.html", settings.emailTemplateDir)
  val resetPasswordHtmlTemplate = getTemplate("resetPassword.html", settings.emailTemplateDir)
  val verifyEmailHtmlTemplate = getTemplate("verifyEmail.html", settings.emailTemplateDir)

  // Prepare pipeline
  implicit val implicitActorRefFactory = actorRefFactory
  implicit val implicitContext = actorRefFactory.dispatcher
  val sendEmailPipeline = sendReceive ~> unmarshal[SendEmailResponse]

  def sendListInvite(invite: Invite): Future[SendEmailResponse] = {
    val sendEmailRequest = SendEmailRequest(settings.emailFrom, invite.email,
      settings.listInviteTitle.replaceAll(
          "inviterEmail",
          invite.email), // FIXME
      inviteHtmlTemplate
        .replaceAll(
          "inviteLink",
          settings.emailSecureUrlPrefix
            + settings.inviteURI
            .replaceAll("inviteValue", invite.code.toLong.toHexString)
            .replaceAll("emailValue", invite.email))
        .replaceAll("logoLink", settings.emailUrlPrefix + "img/logo-text.png")
        .replaceAll("inviterEmail", invite.email) // FIXME
        .replaceAll("sharedList", invite.email) // FIXME
        )
    sendEmail(sendEmailRequest)
  }

  def sendPasswordResetLink(email: String, resetCode: Long): Future[SendEmailResponse] = {
    val sendEmailRequest = SendEmailRequest(settings.emailFrom, email,
      settings.resetPasswordTitle,
      resetPasswordHtmlTemplate
        .replaceAll(
          "resetPasswordLink",
          settings.emailSecureUrlPrefix
            + settings.resetPasswordURI
            .replaceAll("resetCodeValue", resetCode.toHexString)
            .replaceAll("emailValue", email))
        .replaceAll("logoLink", settings.emailUrlPrefix + "img/logo-text.png"))
    sendEmail(sendEmailRequest)
  }

  def sendEmailVerificationLink(email: String, emailVerificationCode: Long): Future[SendEmailResponse] = {
    val sendEmailRequest = SendEmailRequest(settings.emailFrom, email,
      settings.verifyEmailTitle,
      verifyEmailHtmlTemplate
        .replaceAll(
          "verifyEmailLink",
          settings.emailSecureUrlPrefix
            + settings.verifyEmailURI
            .replaceAll("verifyCodeValue", emailVerificationCode.toHexString)
            .replaceAll("emailValue", email))
        .replaceAll("logoLink", settings.emailUrlPrefix + "img/logo-text.png"))
    sendEmail(sendEmailRequest)
  }

  private def sendEmail(sendEmailRequest: SendEmailRequest): Future[SendEmailResponse] = {
    implicit val timeout = Timeout(10 seconds)
    val address = "https://api.mailgun.net/v2/" + settings.mailgunDomain + "/messages"
    sendEmailPipeline {
      Post(address,
          marshal(sendEmailRequest).right.get
              ) ~> addCredentials(BasicHttpCredentials("api", settings.mailgunApiKey))
    }
  }

  private def getTemplate(templateFileName: String, templateDirectory: Option[String]): String = {
    val source = {
      if (templateDirectory.isDefined)
        scala.io.Source.fromFile(templateDirectory.get + "/" + templateFileName)
      else {
        // Read file from templates directory
        scala.io.Source.fromInputStream(getClass.getResourceAsStream("/templates/" + templateFileName))
      }
    }
    val lines = source.mkString
    source.close()
    lines
  }

}

class MailgunClientImpl(implicit val implSettings: Settings, implicit val implActorRefFactory: ActorRefFactory,
  implicit val inj: Injector)
  extends MailgunClient with Injectable {
  override def actorRefFactory = implActorRefFactory
  override def settings = implSettings
}
