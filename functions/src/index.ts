import * as functions from 'firebase-functions';
import * as twilio from 'twilio';
import * as admin from 'firebase-admin';

admin.initializeApp(functions.config().firebase);

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

export const welcomeCall = functions.https.onRequest(async (request, response) => {
    const voiceResponse = new twilio.twiml.VoiceResponse();
    voiceResponse.say("Welcome to crowd calls.");
    voiceResponse.pause({ length: 1 });
    voiceResponse.say("The future is now.");
    voiceResponse.pause({ length: 1 });
    voiceResponse.say({ voice: 'alice', language: 'fr-CA' }, 'Bienvenue. Le future est radieux.');
    voiceResponse.stop();
    return response.contentType('text/xml').send(voiceResponse.toString());
});

export const apiTest = functions.https.onRequest((request, response) => {
  const apiKey = functions.config().twilio.key
  response.send(`My API key is ${apiKey}.`);
});
