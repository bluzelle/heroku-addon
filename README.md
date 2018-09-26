# Bluzelle Heroku Add-on

[![N|Solid](https://bluzelle.com/assets/img/Bluzelle%20-%20Screen%20-%20Logo%20-%20Big%20-%20Blue.png)](https://bluzelle.com/)



The Bluzelle Heroku Add-on is a great addition to your Heroku Application.  Currently in Alpha, the add-on can:

  - Automatically create environment variables, in your Heroku Application, to enable connection to our testnet
  - Provide a dashboard to manage data that your Heroku Application committed to testnet

# Prerequisites

  - Nodejs/npm
  - Heroku CLI
  - A deployed Heroku Application making calls to the Bluzelle database

> If you require assistance creating an application that uses the Bluzelle API, 
> please visit this video:
> https://www.youtube.com/watch?v=u55BgUrzYDg
>Alternatively, here is the write up for building a simple Nodejs application 
>using the Bluzelle API
>https://blog.bluzelle.com/javascript-support-in-bluzelles-lovelace-release-e2b3454ffc0d

# Instructions

1) Login to Heroku using the Heroku CLI:
```sh
$ Heroku login
```
2) Once you've logged into Heroku with the Heroku CLI, you can now install the add-on to your Heroku Application (where APPLICATION_NAME is the name of your Heroku Application)

```sh
$ Heroku addons:create bluzelle:test -a APPLICATION_NAME
```

3) If everything went smoothly and the add-on installed properly, you will find 3 Config Variables (In your Heroku Application Dashboard, under the settings tab, you should see Config Vars.  If you Click on "Reveal Vars", you will see 3 Config Variables that the Bluzelle Add-on had set, BLUZELLE_ADDRESS, BLUZELLE_PORT, and BLUZELLE_UUID)

# Using the Config Vars in your Application

Taken from the example in: 
> https://blog.bluzelle.com/javascript-support-in-bluzelles-lovelace-release-e2b3454ffc0d

the line where you are connecting to testnet:
```sh
bluzelle.connect('ws://testnet.bluzelle.com:51010','45498479–2447–47a6–8c36-efa5d251a283');
```

can be replaced with environment variables that were set by the Add-on:

```sh
bluzelle.connect(process.env.BLUZELLE_ADDRESS +':'+ process.env.BLUZELLE_PORT,process.env.BLUZELLE_UUID);
```
