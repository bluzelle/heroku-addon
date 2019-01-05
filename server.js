
'use strict'

//////////////////////////////////////////
/////Heroku Bluzelle Addon (alpha code)//
////////////////////////////////////////

//importing manifest to access the variables
var addonManifest = require('./addon_manifest.json');
//access config variables
var config = require('./config');
//including bodyParser to handle json requests
var bodyParser = require('body-parser');
//parser for authorization header
var auth = require('basic-auth');
//for generating hash to check requests
var crypto = require('crypto');
//for generating uuids
var uuid = require('node-uuid');
//bluzelle db
var {bluzelle} = require('bluzelle');

//for spawning express server
const express = require('express');
//port for server
const port = process.env.PORT || 8080;
//assignment of express server
const app = express();

app.set('uuid', uuid.v4());
app.set('bluzelleStudioUUID', uuid.v4());
app.set('bluzelleStudioAddress', 'ws://bernoulli.bluzelle.com'); 
app.set('bluzelleStudioPort', '51010');  

//use the endpoints
app.use('/heroku/resources', bodyParser.json());
app.use('/heroku/sso', bodyParser.urlencoded());

//assigned generated uuid to each request
app.use('*', function handleUUID(req, res, next) {
  req.uuid = uuid.v4();
  next();
});

//status check for add-on (base path)
app.get('/', function handleCheckStatus(req, res) {
  return res.status(200).end();
});

//Provisioning Heroku Request
//SSO endpoint.  Perform request check then redirect to SSO dashboard
app.post('/heroku/sso', function handleSSO(req,res) {

  ///////////FIRST CHECK//////////////////
  //check if request is complete, otherwise return an unauthorized response code 
  if( !req.body || !req.body.id || !req.body.token || !req.body.timestamp) {
    if(!req.body)
      console.log("missing body in request");
    else if (!req.body.id)
      console.log("missing id in body of request");
    else if (!req.body.token)
      console.log("missing token in body of request");
    else if (!req.body.timestamp)
      console.log("missing timestamp in body of request");

    return res.status(401).end();
  }

  ///////////SECOND CHECK//////////////////
  //create hash for checking token
  var hash = crypto.createHash('sha1').update(`${req.body.id}:${config.heroku.sso_salt}:${req.body.timestamp}`).digest('hex');

  //check token validity
  if(hash !== req.body.token)
    return res.status(403).end();

  //output request for verification  
  console.log(req.body);

  let blzObj = bluzelle({
    entry: "ws://bernoulli.bluzelle.com:51010",
    uuid: "herokuappsaddons",
    private_pem: "MHQCAQEEIFX4dRK+y8cExp6FCk1vrACBtP9RbWIMgDcBrchQzrqmoAcGBSuBBAAKoUQDQgAE5LhjN3tk2dGAmJnNo9McDvwSTmp0T5M8zqQfK6E4R9qdiIcGICupOblixXnPvUQ1UMzGibU0PVsO0dH8r7/VBw=="
  });
  
  const bluzelleInstance = async function(key, value) {
    // initial create of db
    // await blzObj.createDB();
    await blzObj.create(key, value);
    blzObj.close();
  };

  console.log(req.body);

  bluzelleInstance(JSON.stringify(app.get('uuid')),req.body.app).catch(e => { 
    blzObj.close();
    throw e;
  });

  // Render SSO dashboard after checks.
  //switch to studio.bluzelle.com once SSL issue has been solved
  return res.redirect(`http://bluzellestudio.herokuapp.com?address=${app.get('bluzelleStudioAddress')}&port=${app.get('bluzelleStudioPort')}&uuid=${app.get('bluzelleStudioUUID')}`);
});

//authenticate request.  Check request header and verify against manifest
app.use('/heroku', function handleAuthenticate(req, res, next) {
  var creds = auth(req);
  console.log("heroku provision body: " + creds);
  //check if authorization header is presents
  if ( typeof creds === 'undefined' ) {
    console.log("missing authorization header");
    return res.status(401).end();
  }
  
  //password or id does not match manifest
  if ( creds.pass !== addonManifest.api.password ||
       creds.name !== addonManifest.id ) {
    console.log("mismatch authentication");
    return res.status(401).end();
  }

  // Once authenticated, move on to /heroku/resources endpoint
  next();
});

//End point that handles provisioning.  This handler will take care of heroku provisioning 
//and set the config vars
app.post('/heroku/resources', function handleProvisioning(req, res) {
  res.send({
    'id': app.get('uuid'),
    'config': {
      'BLUZELLEDB_ADDRESS': app.get('bluzelleStudioAddress'),
      'BLUZELLEDB_PORT': app.get('bluzelleStudioPort'),
      'BLUZELLEDB_UUID': app.get('bluzelleStudioUUID')
    }
  });
  res.redirect('/heroku/sso');
});

//Updating Plan changes here.  Since this is in alpha stage, only free tier "test" is available.
//return a service unavailable response
app.put('/heroku/resources/:id', function handlePlanChanges(req, res) {
  return res.status(503).json({
    'message': `${req.uuid}: ` +
      `Unable to make changes to plan`
  });
});

app.listen(port);