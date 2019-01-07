
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
const { URLSearchParams } = require('url');
const fetchNode = require('node-fetch');


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
  res.json({
    'id': app.get('uuid'),
    'config': {
      'BLUZELLEDB_ADDRESS': app.get('bluzelleStudioAddress'),
      'BLUZELLEDB_PORT': app.get('bluzelleStudioPort'),
      'BLUZELLEDB_UUID': app.get('bluzelleStudioUUID')
    }
  });

  var originalUuid = req.body.uuid;
  var addonCallback = req.body.callback_url;
  var clientSecret = "a6426c87-9f35-4320-8e26-becb961d5980"  
  const params = new URLSearchParams();

  console.log(originalUuid);

  params.append('grant_type', 'authorization_code');
  params.append('code', req.body.oauth_grant.code);
  params.append('client_secret', clientSecret);
  
  fetchNode('https://id.heroku.com/oauth/token', { method: 'POST', body: params })
      .then(res => res.json())
      .then(function(response){

        var options = {
          method: 'GET',
          headers: { 
            'Accept': 'application/vnd.heroku+json; version=3', 
            'Content-Type': 'application/json',
            'authorization': 'Bearer ' + response.access_token
          } 
        }
        
        fetchNode(addonCallback, options)
          .then(res => res.json())
          .then(function(response){
            let blzObj = bluzelle({
              entry: "ws://bernoulli.bluzelle.com:51010",
              uuid: "herokubluzelleaddonapps",
              private_pem: "MHQCAQEEIFX4dRK+y8cExp6FCk1vrACBtP9RbWIMgDcBrchQzrqmoAcGBSuBBAAKoUQDQgAE5LhjN3tk2dGAmJnNo9McDvwSTmp0T5M8zqQfK6E4R9qdiIcGICupOblixXnPvUQ1UMzGibU0PVsO0dH8r7/VBw=="
            });
            
            const bluzelleInstance = async function(key, value) {
              // initial create of db
              // await blzObj.createDB();
              await blzObj.create(key, value);
              blzObj.close();
            };
          
            bluzelleInstance(JSON.stringify(originalUuid),response.app.name).catch(e => { 
              blzObj.close();
              throw e;
            });
          });
      });
});

// //Delete endpoint for which an add-on service is deleted
app.delete('/heroku/resources/:id', function handleDelete(req, res) {
  let blzObj = bluzelle({
    entry: "ws://bernoulli.bluzelle.com:51010",
    uuid: "herokubluzelleaddonapps",
    private_pem: "MHQCAQEEIFX4dRK+y8cExp6FCk1vrACBtP9RbWIMgDcBrchQzrqmoAcGBSuBBAAKoUQDQgAE5LhjN3tk2dGAmJnNo9McDvwSTmp0T5M8zqQfK6E4R9qdiIcGICupOblixXnPvUQ1UMzGibU0PVsO0dH8r7/VBw=="
  });
  
  const bluzelleInstance = async function(key) {
    // initial create of db
    // await blzObj.createDB();
    const hasMyKey = await blzObj.has(key);

    if(hasMyKey){
      await blzObj.delete(key);
    }
    
    blzObj.close();
  };

  console.log(req.body)

  bluzelleInstance(req.uuid).catch(e => { 
    blzObj.close();
    throw e;
  });
  return res.status(204).json({
    'message': `${req.uuid}: ` +
      `No Content`
  });
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