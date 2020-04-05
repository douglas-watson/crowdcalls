import * as functions from 'firebase-functions';
import * as twilio from 'twilio';
import * as admin from 'firebase-admin';

// Workaround for Douglas's laptop who can never find the default credentials.
// Store the location to the service account key json file 
// (ask Douglas for a copy)
if (process.env.FIREBASE_CRED) {
  var serviceAccount = require(process.env.FIREBASE_CRED);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://crowdcalls-dev.firebaseio.com"
  });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

const urlForCallVolunteer = function (numbers: string[]) {
  return "/callVolunteer/" + numbers.join('/')
};

export const welcomeCall = functions.https.onRequest(async (request, response) => {
  const selectedNumbers = ['+41774165457', '+41774865315', '+41774165457']
  const nextNumber = selectedNumbers.shift()
  const voiceResponse = new twilio.twiml.VoiceResponse()
  voiceResponse.say({ voice: 'alice', language: 'fr-CA' }, 'Bienvenue. Un volontaire va recevoir votre appel.')
  voiceResponse.dial({
    action: urlForCallVolunteer(selectedNumbers),
  }, nextNumber)
  return response.contentType('text/xml').send(voiceResponse.toString())
});

export const callVolunteer = functions.https.onRequest(async (request, response) => {
  // Expects a path in the format /number1/number2/number3
  const voiceResponse = new twilio.twiml.VoiceResponse()

  let selectedNumbers = request.path.split("/").filter(x => x.length > 0)
  if (!selectedNumbers || selectedNumbers.length == 0) {
    console.log("No numbers to call, end of the line.")
    voiceResponse.say("Aucun volontaire n'est disponible pour le moment.")
    return response.contentType('text/xml').send(voiceResponse.toString())
  }

  // TODO check if call went through. If it did, finish.
  voiceResponse.say("Cette personne n'est pas disponible. Nous appelons un nouveau volontaire.")

  let nextNumber = selectedNumbers.shift()
  console.log("Calling " + nextNumber + " falling back to " + urlForCallVolunteer(selectedNumbers))
  voiceResponse.dial({
    action: urlForCallVolunteer(selectedNumbers),
  }, nextNumber)

  return response.contentType('text/xml').send(voiceResponse.toString())
});

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
