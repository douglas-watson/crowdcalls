# crowdcalls
Crowdsourcing hotlines


## Getting started

Install node and npm, then install firebase tools:

    npm install -g firebase-tools

Authorize the firebase CLI:

    firebase login

Clone this repo

    git clone git@github.com:douglas-watson/crowdcalls.git
    cd crowdcalls/

Associate the local files with the remote firebase project:

    firebase use --add

Give the project any name, for example default.

Install npm dependencies

    cd functions/
    npm install

## Admin

Set up your account by adding your API key to firebase:

```
cd functions
firebase functions:config:set twilio.key="API_SECRET"
```