import { Component, OnInit } from '@angular/core';
import { CameraPreview, CameraPreviewPictureOptions, CameraPreviewOptions, CameraPreviewDimensions } from '@ionic-native/camera-preview/ngx';
import { NavController, AlertController } from '@ionic/angular';
import { SpeechRecognition } from '@ionic-native/speech-recognition/ngx';
import { Stitch, RemoteMongoClient, AnonymousCredential, BSON } from "mongodb-stitch-browser-sdk";
import { Router } from '@angular/router';

@Component({
  selector: 'mirror-component',
  templateUrl: 'mirror-component.page.html',
  styleUrls: ['mirror-component.page.scss']
})
export class MirrorComponent implements OnInit {

  recognizedWord: Array<string>; //the word that has been recognized from the voice recognition
  dataWord: string; //the word taken from the DB

  //add words
  newWord = {
    "word": "bus",
    "correct": false

  };

  //find words
  findWord = { "correct": false };
  findWordOptions = {
    "projection": {
      "word": 1,
      "correct": 1,
    },
    "limit": 1
  };

  client = Stitch.initializeDefaultAppClient('speechtherapyapp-ttndv');
  mongodb = this.client.getServiceClient(RemoteMongoClient.factory, 'mongodb-atlas');
  itemsCollection = this.mongodb.db('SpeechTherapy').collection('bWords');

  constructor(private cameraPreview: CameraPreview, public navCtrl: NavController, private speechRecognition: SpeechRecognition, public alertController: AlertController, private router: Router) {
    this.connectToDB();
  }

  public connectToDB() {

    this.client.auth.loginWithCredential(new AnonymousCredential()).then(user => {
      console.log('Logged in as anonymous user with id' + user.id);
    });

    // this.addWordToDB();
    this.findWordFunc();

  }

  public addWordToDB() {
    //insert into the collection - use insertOne for only one word and insertMany for more than one
    this.itemsCollection.insertOne(this.newWord)
      .then(result => console.log("`Successfully inserted item with _id: ${result.insertedId}`"))
      .catch(err => console.error(`Failed to insert item: ${err}`));
  }

  public findWordFunc() {
    //find document
    this.itemsCollection.find(this.findWord, this.findWordOptions).toArray()
      .then(items => {
        console.log(`Successfully found ${items.length} documents.`)
        items.forEach(item => {
          this.dataWord = item['word'];
          // console.log("the item is", item['word']);
        });
        return items
      })
      .catch(err => console.error(`Failed to find documents: ${err}`))
  }

  async updateWordProperty(update) {

    var updateWord = { "word": update };

    var updateCorrectProperty = { //which property to update
      "$set": {
        "correct": true,
      }
    };
    var updateOptions = { "upsert": false }; //if it doesn't find the word, add it at the end of the document => set to false

    this.itemsCollection.updateOne(updateWord, updateCorrectProperty, updateOptions)
      .then(result => {
        const { matchedCount, modifiedCount } = result;
        if (matchedCount && modifiedCount) {
          console.log(`Successfully updated the item.`)
        }
      })
      .catch(err => console.error(`Failed to update the item: ${err}`))
  }

  ngOnInit() {
    this.startFrontCamera();

  }

  ngOnChanges() {
    this.findWordFunc();
  }

  public startFrontCamera() { //front camera

    //  camera options (Size and location). In the following example, the preview uses the rear camera and display the preview in the back of the webview
    let options = {
      x: 0,
      y: 0,
      width: window.screen.width,
      height: window.screen.height,
      // camera: CameraPreview.CAMERA_DIRECTION.BACK, //use rear camera, by default is front one 
      toBack: true, //back button
      tapPhoto: true, //when you tap on the screen it "takes" picture
      tapFocus: false,
      previewDrag: false
    };
    if (this.cameraPreview.startCamera(options)) {
      console.log("camera is on");
    }
    else { console.log("not on") }

    //check for speech recognition permissions
    this.speechRecognition.hasPermission()
      .then((hasPermission: boolean) => {

        if (!hasPermission) {
          this.speechRecognition.requestPermission()
            .then(
              () => console.log('Granted'),
              () => console.log('Denied')
            )
        }

      });
  }

  public startVoiceRecognition() { //voice recognition
    let options = {
      language: 'da-DK',
      showPopup: false
    }

    this.speechRecognition.startListening(options)
      .subscribe(
        (matches: Array<string>) => {
          console.log(matches);
          // this.recognizedWord = matches[0];
          this.recognizedWord = matches;
          console.log("the word is " + this.recognizedWord);
          this.checkWord(this.recognizedWord);

        },
        (onerror) => console.log('error:', onerror)
      )

  }

  async checkWord(checkWord: Array<string>) {
    if (checkWord.includes(this.dataWord)) {

      this.updateWordProperty(this.dataWord);

      const alert = await this.alertController.create({
        header: 'Correct',
        // subHeader: 'Subtitle',
        message: 'You are doing great! Keep up with the good work!',
        buttons: [{
          text: 'Next',
          handler: () => {
            this.findWordFunc();
          }
        },
        {
          text: 'Go back',
          handler: () => {
            this.router.navigate(['/words-menu']);
            console.log('Go back clicked');
          }
        }]
      });

      await alert.present();
    }

    else {
      const alert = await this.alertController.create({
        header: 'Sorry, could not understand that',
        // subHeader: 'Subtitle',
        message: 'You are doing great! Maybe it was me, who did not understood you right! Would you like to try again?',
        // buttons: ['Try again', 'Skip']
        buttons: [
          {
            text: 'Try again',
            handler: () => {

              this.startVoiceRecognition();
            }
          }, {
            text: 'Skip',
            handler: () => {
              console.log('Skip clicked');
              this.updateWordProperty(this.dataWord);
              this.findWordFunc();
            }
          }]
      });

      await alert.present();
    }
  }
}