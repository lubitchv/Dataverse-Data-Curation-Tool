import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef
} from '@angular/core';
import { NgModule } from '@angular/core';
import { DdiService } from '../ddi.service';
import { xml2json } from '../../assets/js/xml2json';
import { json2xml } from '../../assets/js/json2xml';

import { MatButtonModule, MatSnackBar } from '@angular/material';
import { VarComponent } from '../var/var.component';
import * as FileSaver from 'file-saver';
import * as XMLWriter from 'xml-writer';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-interface',
  templateUrl: './interface.component.html',
  styleUrls: ['./interface.component.css']
})
@NgModule({
  imports: [MatButtonModule],
  exports: [MatButtonModule]
})
export class InterfaceComponent implements OnInit {
  @ViewChild(VarComponent) child;
  @ViewChild('scrollMe') private myScrollContainer: ElementRef;

  data = null; // store the xml
  ddiLoaded = false; // show the loading
  title;
  firstCitat;
  secondCitat;
  doi;
  filename;
  variableGroups = []; // store the variables in an array display
  _variables = []; // store the variables to be broadcast to child
  _id = null; // file id
  metaId = null;
  baseUrl = null;
  http: HttpClient;

  constructor(
    private ddiService: DdiService,
    public snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    console.log("Start");
    let uri = null;
    uri = this.ddiService.getParameterByName('siteUrl');
    this.baseUrl = this.ddiService.getBaseUrl();
    this._id = this.ddiService.getParameterByName('dfId');
    this.metaId = this.ddiService.getParameterByName('fileMetadataId');

    if (!uri && this._id != null) {
      uri = this.baseUrl + '/api/access/datafile/' + this._id + '/metadata/ddi';
      if (this.metaId != null) {
        uri = uri + '?fileMetadataId=' + this.metaId;
      }
    } else {
      if (uri) {
        uri = uri + '/api/access/datafile/' + this._id + '/metadata/ddi';
        if (this.metaId != null) {
          uri = uri + '?fileMetadataId=' + this.metaId;
        }
      } else {
        // Just for testing purposes
        //uri = this.baseUrl + '/assets/FOCN_SPSS_20150525_FORMATTED-ddi.xml';
        uri = this.baseUrl + '/assets/test_groups.xml';
        // uri = this.baseUrl + '/assets/arg-drones-E-2014-can.xml';
      }
    }
    this.getDDI(uri);
  }

  getDDI(_uri): void {
    const url = _uri;
    this.ddiService
      .getDDI(url)
      .subscribe(
        data => this.processDDI(data),
        error => console.log(error),
        () => this.completeDDI()
      );
  }

  scrollNav() {
    const elm = this.myScrollContainer['_elementRef'].nativeElement;
    elm.scrollTop = elm.scrollHeight;
  }
  processDDI(data) {
    const parser = new DOMParser();
    this.data = parser.parseFromString(data, 'text/xml');
  }

  completeDDI() {
    this.showVarsGroups();
    this.showVars();
    this.title = this.data
      .getElementsByTagName('stdyDscr')[0]
      .getElementsByTagName('titl')[0].textContent;
    const citation = this.data
      .getElementsByTagName('stdyDscr')[0]
      .getElementsByTagName('biblCit')[0].textContent;
    const start = citation.indexOf('http');
    const temp = citation.substr(start);
    const end = temp.indexOf(',');
    this.doi = temp.substr(0, end);
    this.firstCitat = citation.substr(0, start );
    this.firstCitat = this.firstCitat;
    this.secondCitat = temp.substr(end);
    this.secondCitat = this.secondCitat;

    this.filename = this.data
      .getElementsByTagName('fileDscr')[0]
      .getElementsByTagName('fileName')[0].textContent;
    this.showDDI();

    const agency =  this.data.getElementsByTagName('IDNo')[0];
    const obj = JSON.parse(xml2json(agency, ''));
    console.log(obj);
  }

  showVarsGroups() {
    const elm = this.data.getElementsByTagName('varGrp');

    for (const elmIn of elm) {
      const obj = JSON.parse(xml2json(elmIn, ''));
      this.variableGroups.push(obj);
    }
  }

  showVars() {
    const variables = [];
    const elm = this.data.getElementsByTagName('var');
    for (const elm_in of elm) {
      variables.push(JSON.parse(xml2json(elm_in, '')));
    }
    // flatten the table structure so it can be sorted/filtered appropriately
    const flat_array = [];
    for (let i = 0; i < variables.length; i++) {
      const obj = variables[i];
      // make equivalent variable to allow sorting
      for (const j in obj.var) {
        if (j.indexOf('@') === 0) {
          obj.var[j.substring(1).toLowerCase()] = obj.var[j];
        }
      }

      if (typeof obj.var.catgry !== 'undefined') {
        if (typeof obj.var.catgry.length === 'undefined') {
          // If there is only one category
          obj.var.catgry = [obj.var.catgry];
        }
        for (let k = 0; k < obj.var.catgry.length; k++) {
          if (typeof obj.var.catgry[k].catStat !== 'undefined') {
            if (typeof obj.var.catgry[k].catStat.length === 'undefined') {
              obj.var.catgry[k].catStat = [obj.var.catgry[k].catStat];
            }
          }
        }
      }
      if (typeof obj.var.universe !== 'undefined') {
        if (typeof obj.var.universe.size === 'undefined') {
          obj.var.universe = {'#text': obj.var.universe};
        }
      }

      if (typeof obj.var.notes !== 'undefined') {
        if (typeof obj.var.notes.length !== undefined && obj.var.notes.length === 2 ) {
          obj.var.notes = {'#cdata': obj.var.notes[1]['#cdata'],
                                    '#text': obj.var.notes[0]['#text'],
                                    '@level': obj.var.notes[0]['@level'],
                                    '@subject': obj.var.notes[0]['@subject'],
                                    '@type': obj.var.notes[0]['@type']};
        }
      }
      flat_array.push(obj.var);
    }

    this._variables = flat_array;
    this.child.onUpdateVars(this._variables);
  }
  // pass the selected ids to the var table for display
  broadcastSubSetRows(ids) {
    this.child.onSubset(ids);
  }

  broadcastSelect(_id) {
    // set the var table header to show the selection
    this.child.selectGroup(_id);
  }

  broadcastDraggedGroup(_id) {
    this.child.draggedGroup(_id);
  }

  broadcastDeselectGroup() {
    this.child.disableSelectGroup();
  }

  showDDI() {
    this.ddiLoaded = true;
  }

  // Create the XML File
  makeXML(dv) {

      const doc = new XMLWriter();
      doc.startDocument();
      if (dv === false) {
        this.addStdyAndfileDscr(doc);
      }
      doc.startElement('dataDscr');

      // add groups
      for (const group of this.variableGroups) {
        if ( group.varGrp.labl !== null && group.varGrp.labl.trim() !== '' ) {
          doc.startElement('varGrp');
          doc.writeAttribute('ID', group.varGrp['@ID']);
          doc.writeAttribute('var', group.varGrp['@var']);
          doc.startElement('labl');
          doc.text(group.varGrp.labl);
          doc.endElement();
          doc.endElement();
        }
      }
      // add variables
      for (let i = 0; i < this._variables.length; i++) {
        // start variable (var)
        doc.startElement('var');
        doc.writeAttribute('ID', this._variables[i]['@ID']);
        doc.writeAttribute('name', this._variables[i]['@name']);
        if (typeof this._variables[i]['@intrvl'] !== 'undefined') {
          doc.writeAttribute('intrvl', this._variables[i]['@intrvl']);
        }
        if (typeof this._variables[i]['@wgt'] !== 'undefined' && this._variables[i]['@wgt'] !== '') {
          doc.writeAttribute('wgt', this._variables[i]['@wgt']);
        }
        if (typeof this._variables[i]['@wgt-var'] !== 'undefined' && this._variables[i]['@wgt-var'] !== '') {
          doc.writeAttribute('wgt-var', this._variables[i]['@wgt-var']);
        }
        // start location
        if (typeof this._variables[i].location !== 'undefined') {
          doc.startElement('location').writeAttribute('fileid', this._variables[i].location['@fileid']);
          doc.endElement();
        }
        // end location
        // start labl
        if (typeof this._variables[i].labl !== 'undefined') {
          doc.startElement('labl');
          doc.writeAttribute('level', this._variables[i].labl['@level']);
          doc.text(this._variables[i].labl['#text']);
          doc.endElement();
        }
        // end labl
        // start sumStat
        if (typeof this._variables[i].sumStat !== 'undefined') {
          if (typeof this._variables[i].sumStat.length !== 'undefined') {
            for (let j = 0; j < this._variables[i].sumStat.length; j++) {
              doc.startElement('sumStat');
              doc.writeAttribute('type', this._variables[i].sumStat[j]['@type']);
              doc.text(this._variables[i].sumStat[j]['#text']);
              doc.endElement();
            }
          }
        }
        // end sumStat
        // start catgry
        if (typeof this._variables[i].catgry !== 'undefined') {
          if (typeof this._variables[i].catgry.length !== 'undefined') {
            for (let j = 0; j < this._variables[i].catgry.length; j++) {
              doc.startElement('catgry');
              if (typeof this._variables[i].catgry[j].catValu !== 'undefined') {
                doc.startElement('catValu').text(this._variables[i].catgry[j].catValu);
                doc.endElement();
              }
              if (typeof this._variables[i].catgry[j].labl !== 'undefined') {
                doc.startElement('labl');
                doc.writeAttribute('level', this._variables[i].catgry[j].labl['@level']);
                doc.text(this._variables[i].catgry[j].labl['#text']);
                doc.endElement();
              }
              if (typeof this._variables[i].catgry[j].catStat !== 'undefined') {
                // frequency
                if (typeof this._variables[i].catgry[j].catStat.length !== 'undefined') {
                  doc.startElement('catStat');
                  doc.writeAttribute('type', this._variables[i].catgry[j].catStat[0]['@type']);
                  doc.text(this._variables[i].catgry[j].catStat[0]['#text']);
                  doc.endElement();
                  // weighted frequency
                  if (this._variables[i].catgry[j].catStat.length > 1) {
                    doc.startElement('catStat');
                    doc.writeAttribute('wgtd', this._variables[i].catgry[j].catStat[1]['@wgtd']);
                    doc.writeAttribute('type', this._variables[i].catgry[j].catStat[1]['@type']);
                    doc.text(this._variables[i].catgry[j].catStat[1]['#text']);
                    doc.endElement();
                  }
                }
              }
              doc.endElement();
            }
          }
        }
        // end catgry
        // start qstn
        if (typeof this._variables[i].qstn !== 'undefined' &&
            ((typeof this._variables[i].qstn.qstnLit !== 'undefined' && this._variables[i].qstn.qstnLit !== '') ||
                (typeof this._variables[i].qstn.ivuInstr !== 'undefined' && this._variables[i].qstn.ivuInstr !== '') ||
            (typeof this._variables[i].qstn.postQTxt !== 'undefined' && this._variables[i].qstn.postQTxt !== ''))) {

          doc.startElement('qstn');
          if (typeof this._variables[i].qstn.qstnLit !== 'undefined') {
            doc.startElement('qstnLit').text(this._variables[i].qstn.qstnLit);
            doc.endElement();
          }
          if (typeof this._variables[i].qstn.ivuInstr !== 'undefined') {
            doc.startElement('ivuInstr').text(this._variables[i].qstn.ivuInstr);
            doc.endElement();
          }
          if (typeof this._variables[i].qstn.postQTxt !== 'undefined') {
            doc.startElement('postQTxt').text(this._variables[i].qstn.postQTxt);
            doc.endElement();
          }
          doc.endElement();
        }
        // end qstn
        // start varFormat
        if (typeof this._variables[i].varFormat !== 'undefined') {
          doc.startElement('varFormat');
          doc.writeAttribute('type', this._variables[i].varFormat['@type']);
          doc.endElement();
        }
        // end varFormat
        // start notes
        if (typeof this._variables[i].notes !== 'undefined' ) {

          // start notes cdata
          if (typeof this._variables[i].notes['#cdata'] !== 'undefined' && this._variables[i].notes['#cdata'] !== '') {
            doc.startElement('notes');
            doc.startCData();
            doc.writeCData(this._variables[i].notes['#cdata']);
            doc.endCData();
            doc.endElement();
          }
          // end notes cdata
          doc.startElement('notes');
          doc.writeAttribute('subject', this._variables[i].notes['@subject']);
          doc.writeAttribute('level', this._variables[i].notes['@level']);
          doc.writeAttribute('type', this._variables[i].notes['@type']);
          doc.text(this._variables[i].notes['#text']);
          doc.endElement();
        }
        // end notes
        // start universe
        if (typeof this._variables[i].universe !== 'undefined' && this._variables[i].universe['#text'] !== '') {
          doc.startElement('universe');
          doc.text(this._variables[i].universe['#text']);
          doc.endElement();
        }
        // end universe
        // end variable (var)
        doc.endElement();
      }

      doc.endDocument();
      return doc;
  }

  addStdyAndfileDscr(doc) {
    doc.startElement('stdyDscr');
    doc.startElement('citation');
    doc.startElement('titlStmt');
    const titl = this.data.getElementsByTagName('titl')[0].textContent;
    doc.startElement('titl').text(titl);
    doc.endElement(); // end titl
    doc.startElement('IDNo');
    const agency =  this.data.getElementsByTagName('IDNo')[0];
    const obj = JSON.parse(xml2json(agency, ''));
    doc.writeAttribute('agency', obj.IDNo['@agency']).text(obj.IDNo['#text']);
    doc.endElement('IDNo'); // end IDNo
    doc.endElement(); // end titlStmt
    doc.startElement('rspStmt');
    const AuthEnty = this.data.getElementsByTagName('AuthEnty')[0].textContent;
    doc.startElement('AuthEnty').text(AuthEnty);
    doc.endElement(); // end AuthEnty
    doc.endElement(); // end rspStmt
    const biblCit = this.data.getElementsByTagName('biblCit')[0].textContent;
    doc.startElement('biblCit').text(biblCit);
    doc.endElement(); // biblCit
    doc.endElement(); // end citation
    doc.endElement(); // end stdyDscr

  }

  // Save the XML file locally
  onSave() {
      const dv = false;
      const doc = this.makeXML(dv);
      const text = new Blob([doc.toString()], {type: 'application/xml'});
      const tl = this.title + '.xml';

      FileSaver.saveAs(text, 'dct.xml');
  }

  // Send the XML to Dataverse
  sendToDV() {
    const key = this.ddiService.getParameterByName('key');
    const dv = true;
    const doc = this.makeXML(dv);

    if (key !== null) {
      const url = this.baseUrl + '/api/edit/' + this._id; // + "/" + this.metaId;

      this.ddiService
          .putDDI(url, doc.toString(), key)
          .subscribe(
              data => {
                console.log('Data ');
                console.log(data);
              },
              error => {
                console.log('Error');
                console.log(error);
              },
              () => {
                // console.log('Ok');
                this.snackBar.open('Saved to Dataverse', '', {
                  duration: 2000
                });
              });
    } else {
      console.log('API Key missing');
    }
  }
}
