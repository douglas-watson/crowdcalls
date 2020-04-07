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

Serve the functions locally for development:

    firebase serve --only functions

Once you are happy with your new code, push them to the server:

    firebase deploy

## Troubleshooting

If requests to the firestore systematically fail with the error "Error: Could
not load the default credentials", then get the a "Service account key" json
file from Douglas (don't generate a new one or it will break other's code). Place that file outside of the project tree, and store the location of that file in the GOOGLE_APPLICATION_CREDENTIALS environment variable:

    # for example:
    export GOOGLE_APPLICATION_CREDENTIALS=$PWD/../crowdcalls-dev-firebase-adminsdk-<myidentifier>.json

Then this file will be loaded when serving functions locally.


## Admin

Set up your account by adding your API key to firebase:

```
cd functions
firebase functions:config:set twilio.key="API_SECRET"
```