cd ../core
mvn clean install -DskipTests=true
cd ../cordova
mvn generate-resources
# copy sources to iOS
cd app
cordova prepare ios
cd ..