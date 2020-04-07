import * as functions from 'firebase-functions';
import * as twilio from 'twilio';
import * as admin from 'firebase-admin';
import { ConferenceInstance } from 'twilio/lib/rest/api/v2010/account/conference';

// Client is used to initiate calls. TwiML is used to instruct Twilio how to handle a call.
const twilioClient = twilio(functions.config().twilio.account_sid, functions.config().twilio.key)

admin.initializeApp();

const db = admin.firestore();


/* * * * * * * * * * * * * * * * * * * * 
 *  UTILITY FUNCTIONS
 * * * * * * * * * * * * * * * * * * * */

const urlBase = function () {
  const project = process.env.GCLOUD_PROJECT === undefined && 'crowdcalls-dev' || process.env.GCLOUD_PROJECT
  return 'http://us-central1-' + project + '.cloudfunctions.net'
}

const urlBuild = function (...args: string[]) {
  return urlBase() + "/" + args.join("/")

}

// const urlForCallNextVolunteer = function (numbers: string[]) {
//   return "/callNextVolunteer/" + numbers.join('/')
// };

/* * * * * * * * * * * * * * * * * * * * 
/* TWILIO CLIENT FUNCTIONS - MANAGE QUEUE
/* * * * * * * * * * * * * * * * * * * */

/* Initiate a call with the first volunteer in the list of numbers.

If the volunteer accepts the call, Twilio requests joinVolunteerToConference. If
he refuses, Twilio redirects to dialNextVolunteer with the remaining numbers,
which in turn calls this function.

*/
const dialVolunteer = (roomId: string, numbers: string[]) => {

  // Instructions for the outgoing call:
  const voiceResponse = new twilio.twiml.VoiceResponse()
  voiceResponse
    .gather({
      action: urlBuild("joinVolunteerToConference", roomId),
      numDigits: 1,
      method: "get",
      timeout: 10,
    })
    .say("Bonjour, une personne demande de l'aide sur la Hotline. Appuyez sur une touche pour prendre l'appel, ou raccrochez pour le refuser.")

  // If this point is reached, call was not accepted nor hung up on.
  voiceResponse.say("Vous n'avez pas pris cet appel.")
  const followingNumbers = numbers.slice(1, numbers.length).join("/")
  // TODO: check if redirect is the best way to handle this.

  // TODO: this should now be redundant based on the face that statusCallBack is used.
  voiceResponse.redirect(urlBuild("callNextVolunteer", roomId, followingNumbers))

  // TODO: track state: to know if the initial callSid has been served.

  // Start outgoing call with those insctructions.
  return twilioClient.calls
    .create({
      twiml: voiceResponse.toString(),
      statusCallback: urlBuild("callNextVolunteer", roomId, followingNumbers),
      to: '+41774165457',
      from: '+41215391000',
    })
}

/* End the conference base on 'friendly' name */
const endConference = (roomId: string) => {
  return twilioClient.conferences
    .list({ friendlyName: roomId, status: 'in-progress', limit: 20 })
    .then(confList => {
      const promises: Promise<ConferenceInstance>[] = []
      confList.forEach(conf => {
        promises.push(conf.update({ status: 'completed' }))
      })
      return Promise.all(promises)
    })
}

/* * * * * * * * * * * * * * * * * * * * 
 *  PUBLIC HANDLERS - CALL RECEIVING
 * * * * * * * * * * * * * * * * * * * */

export const welcomeCall = functions.https.onRequest((request, response) => {
  // Puts the caller in a conference room identified by the call Sid. Then calls
  // a list of volunteers one at a time, until one of them accepts the call by
  // entering a digit on their phone. The volunteer who accepts the call is connected
  // to this new conference room.
  const selectedNumbers = ['+41774165457', '+41774865315', '+41774165457']

  const callSid = request.body.CallSid === undefined && 'default' || request.body.CallSid
  const voiceResponse = new twilio.twiml.VoiceResponse()

  // Start calling volunteers.
  dialVolunteer(callSid, selectedNumbers)
    .then(() => {
      voiceResponse.say("Bonjour, nous cherchons un volontaire pour prendre votre appel.")
      voiceResponse.dial().conference({
        startConferenceOnEnter: false,
        endConferenceOnExit: true,
      }, callSid)
      // TODO : Check if conference was answered.
      voiceResponse.say("Aucun bénévole n'est disponible pour le moment. Merci de rappeler plus tard.")
      return response.contentType('text/xml').send(voiceResponse.toString())
    })
    .catch(error => {
      console.log("Error dialing first volunteer in list. CallSid: ", callSid, "Numbers: ", selectedNumbers, error)
      voiceResponse.say("Erreur du système: nous ne pouvons prendre votre appel pour le moment.")
      return response.contentType('text/xml').send(voiceResponse.toString())
    })
});


/* This function is GET'd by twilio only after gathering input from a volunteer.
  Instruct twilio to connect the volunteer to the conference based on asker ID.
  This attribute is given as the GET request path:
  /joinVolunteerToConference/roomId
*/
export const joinVolunteerToConference = functions.https.onRequest((request, response) => {

  const voiceResponse = new twilio.twiml.VoiceResponse()

  const pathAttributes = request.path.split("/").filter(x => x.length > 0)
  if (pathAttributes.length === 0) {
    // Really this path shouldn't be reachable.
    voiceResponse.say("Erreur: aucun appel à joindre.")
    return response.send(voiceResponse.toString())
  }

  const roomId = pathAttributes[0]
  voiceResponse.say("Mise en relation")
  voiceResponse.dial().conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
  }, roomId)

  return response.send(voiceResponse.toString())
})

/* callNextVolunteer is requested if the previous volunteer didn't accept the call.

At this point there are no active calls on the volunteer side. We either initiate
a call with a new volunteer or close the conference room to end the Requester's call.
*/
export const callNextVolunteer = functions.https.onRequest(async (request, response) => {
  // Expects a path in the format roomId/number1/number2/number3

  const pathAttributes = request.path.split("/").filter(x => x.length > 0)

  if (pathAttributes.length === 0) {
    console.log("Error, no roomId specified.")
    return response.status(500).send("No roomId specified for the call chain.")
  }

  const roomId = pathAttributes[0]
  const selectedNumbers = pathAttributes.slice(1, pathAttributes.length)

  if (selectedNumbers.length === 0) {
    console.log("No numbers left to call, end of the line. Disconnecting room ID", roomId)
    return endConference(roomId)
      .then(() => response.send("Call over."))
      .catch(error => {
        console.log("Error terminating room:", roomId, error)
        response.send("Error terminating conference - caller is left hanging.")
      })
  }

  dialVolunteer(roomId, selectedNumbers)
    .then(call => {
      console.log("Next volunteer in line called with numbers: ", selectedNumbers);
      response.send("Done.")
    })
    .catch(error => {
      console.log("Error dialing next volunteer...where to now?")
      response.status(500).send("Argh failed to call next guy")
    })
});

/* * * * * * * * * * * * * * * * * * * * 
 *  DB AND ENV LOOKUP
 * * * * * * * * * * * * * * * * * * * */

export const apiTest = functions.https.onRequest((request, response) => {
  const apiKey = functions.config().twilio.key
  response.send(`My API key is ${apiKey}.`);
});


// const getClosestNumber = function(postcode: number) {
//   return postcode;
// } 

export const retrieveNumber = functions.https.onRequest((request, response) => {
  const volunteersRef = db.collection('volunteers');
  volunteersRef.orderBy('postcode').limit(10).get()
    .then(snapshot => {
      if (snapshot.empty) {
        console.log("No entries found");
        response.sendStatus(404);
        return;
      }

      let results = "";
      snapshot.forEach(volunteer => {
        const data = volunteer.data();
        console.log(data.postcode, '->', data.phone);
        results += `Postcode: ${data.postcode} -> ${data.phone}\n`;
      })

      response.set('Content-Type', 'text/plain');
      response.send(results);
    })
    .catch(err => {
      console.log("Error getting volunteers", err);
      response.sendStatus(500);
    })
})
