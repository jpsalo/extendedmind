#!/usr/bin/env node
var path = require( "path" ),
    fs = require( "fs" ),
    shell = require( "shelljs" ),
    rootdir = process.argv[ 2 ],
    androidroot = rootdir + "/platforms/android",
    fontroot = rootdir + "/assets/fonts",
    buildroot = rootdir + "/assets/build/android";

if (shell.test('-d', androidroot)){
  // copy fonts
  shell.exec( "cp -f " + fontroot + "/Helvetica*.* " + androidroot + "/assets/www/static/fonts", {silent:false} );

  // copy edited Android sources
  shell.exec( "cp -f " + buildroot + "/*.java " + androidroot + "/src/org/extendedmind", {silent:false} );
}

process.exit(0);