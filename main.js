var argv = location.search.replace(/[\?\/]/g, '').split('&');
var params = {
  "tuto": "ocaml-example.html",
  "lang": "ocaml"
};
for(var i = 0; i < argv.length; i++) {
  var a = argv[i].split('=');
  params[a[0]] = a[1];
};

var editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.getSession().setMode("ace/mode/" + params.lang);

var unsaved = false;
editor.on("change", function() {unsaved = true;});

window.addEventListener("beforeunload", function (e) {
  if(unsaved) {
    var confirmationMessage = "You have unsaved modifications.";
    (e || window.event).returnValue = confirmationMessage;
    return confirmationMessage;
  }
});

var tp = document.getElementById("tp");

var input = document.getElementById("input");
var output = document.getElementById("output");
var invite = document.getElementById("prompt");
var worker = params.lang + "-worker.js";
var interpreter = new Worker(worker);
var tester = new Worker(worker);
var tooLong = false;
var ready = false;
var lines = 1;
invite.style.display = "none";
input.style.display = "none";

var history = [];
var h = [""];
var pos = 0;

var questions = [];
var toValidate = [];

function onresponse(e) {
  if("out" in e.data)
    output.appendChild(document.createTextNode(e.data.out))
  if("res" in e.data)
    output.appendChild(document.createTextNode(e.data.res))
  if("ready" in e.data) {
    invite.innerHTML = e.data.ready;
    ready = true;
    lines = 1;
    input.rows = 1;
    input.rows = lines;
    invite.style.display = "block";
    input.style.display = "block";
    input.value = "";
    pos = history.length;
    h = history.slice();
    h.push("");
  }
}

interpreter.onmessage = onresponse;

function onresult(e) {
  console.log(e.data);
  if("res" in e.data && (/^Error: /.test(e.data.res) ||
                         /^Error: /.test(e.data.res))) {
    var annot = editor.getSession().getAnnotations();
    annot.push({"row": e.data.id, "text": e.data.res, "type": "error"});
    editor.getSession().setAnnotations(annot);
  } else if("res" in e.data && e.data.id < 0 && e.data.res === "- : bool = true\n") {
    var q = toValidate[-1-e.data.id].question;
    toValidate.splice(-1-e.data.id, 1)
    var onlyOne = true;
    for(var i = 0; i < toValidate.length; i++)
      onlyOne = onlyOne && toValidate[i].question !== q;
    if(onlyOne)
      questions[q].style.backgroundColor = "#D0FFD0";
  }
}

function reset() {
  interpreter.terminate();
  interpreter = new Worker(worker);
  output.innerHTML = "";
  ready = false;
  lines = 1;
  invite.style.display = "none";
  input.style.display = "none";
  interpreter.onmessage = onresponse;
}

function save() {
  window.open("data:text/x-ocaml;charset=utf-8,"
             +encodeURIComponent(editor.getValue()));
  unsaved = false;
}

document.onkeypress = function(ev) {
  if(ev.keyCode == 27 && ev.ctrlKey) {
    reset();
  } else if(ev.charCode == 115 && ev.ctrlKey) {
    save();
    return false;
  } else if(ev.charCode == 111 && ev.ctrlKey) {
    openFile(pickFile());
    return false;
  }
}

function send(s) {
  if(history.length < 1 || s !== history[history.length - 1]) {
    history.push(s);
  }
  ready = false;
  invite.style.display = "none";
  input.style.display = "none";
  interpreter.postMessage({"req": s, "id": 0});
  input.value = "";
}

function getSentences(s) {
  var ans = [];
  var i = 0;
  var j = 0;
  var comment = 0;
  var row = 0;
  var r = 0;
  while(i < s.length) {
    if(s[i] == '(' && i+1 < s.length && s[i+1] == '*') {
      comment++;
      i += 2;
    } else if(comment > 0 && s[i] == '*' && i+1 < s.length && s[i+1] == ')') {
      comment--;
      i += 2;
    } else if(s[i] == '\n') {
      row++;
      i++;
    } else if(comment > 0 || /\s/.test(s[i])) {
      i++;
    } else {
      j = i;
      r = row;
      while(j < s.length -1 && (comment > 0 || s[j] !== ';' || s[j+1] !== ';')) {
	if(s[j] == '(' && s[j+1] == '*') {
	  comment++;
	  j += 2;
	} else if(comment > 0 && s[j] == '*' && s[j+1] == ')') {
	  comment--;
	  j += 2;
	} else if(s[j] == '\n') {
	  row++;
	  j++;
        } else {
          j++;
        }
      }
      if(j < s.length - 1) {
        ans.push({"row": r, "s": s.slice(i, j+2), "begin": i, "end": j+2});
      }
      i = j+2;
    }
  }
  return ans;
}

function key(ev) {
  function timeTravel(delta) {
    h[pos] = input.value;
    pos += delta;
    input.value = h[pos];
    var m = h[pos].match(/\n/g);
    if(m === null)
      lines = 1
    else
      lines = m.length + 1;
    input.rows = lines;
  }
  if(ev.keyCode == 13 && ready) { // ENTER
    var sentences = getSentences(input.value);
    if(sentences.length > 0) {
      send(sentences[0].s);
    } else {
      lines++;
      input.rows = lines;
    }
  } else if(ev.keyCode == 38 &&
            pos > 0 &&
            (input.value.indexOf("\n") < 0 ||
             input.selectionStart <= input.value.indexOf("\n"))) { // UP
    timeTravel(-1);
  } else if(ev.keyCode == 40 &&
            pos < history.length &&
            input.selectionEnd > input.value.lastIndexOf("\n")) { // DOWN
    timeTravel(1);
  }
}

function test(sentences) {
  tester.terminate();
  tester = new Worker(worker);
  tester.onmessage = onresult;
  editor.getSession().setAnnotations([]);
  for(var i = 0; i < sentences.length; i++) {
    tester.postMessage({"req": sentences[i].s, "id": sentences[i].row});
  }
  for(var i = 0; i < toValidate.length; i++) {
    tester.postMessage({"req": toValidate[i].test, "id": -1-i});
  }
  console.log("tests sent");
}

function executeAll() {
  var sentences = getSentences(editor.getValue());
  for(var i = 0; i < sentences.length; i++) {
    send(sentences[i].s);
  }
  test(sentences);
}

function execute() {
  var sentences = getSentences(editor.getValue());
  var cursor = editor.getSession().getDocument().positionToIndex(editor.getCursorPosition());
  var notDone = true;
  for(var i = 0; notDone && i < sentences.length; i++) {
    if(sentences[i].begin <= cursor && sentences[i].end >= cursor) {
      send(sentences[i].s);
      notDone = false;
    } 
  }
  if(notDone && sentences.length > 0)
    send(sentences[sentences.length - 1].s);
  test(sentences);
}

function submit(ev) {
  if(ev.keyCode == 13 && ev.ctrlKey) {
    if(ev.shiftKey) {
      executeAll();
    } else {
      execute();
    }
  }
}

function pickFile() {
  var file = prompt("Enter the URL of the file");
  if(!(/^http:\/\//.test(file) || /^https:\/\//.test(file) || /^ftp:\/\//.test(file)))
    file = "http://" + file;
  return file;
}

function openFile(file) {
  if(file === null)
    return;
  file = decodeURIComponent(file);
  var req = new XMLHttpRequest();
  req.open("GET", file, true);
  req.send();
  req.onload = function() {
    tp.innerHTML = req.responseText;
    questions = tp.getElementsByClassName("question");
    for(var i = 0; i < questions.length; i++) {
      var t = questions[i].getElementsByClassName("test");
      for(var j = 0; j < t.length; j++) {
        toValidate.push({"test": t[j].textContent, "question": i});
      }
    }
    var codes = tp.getElementsByTagName("pre");
    for(var i = 0; i < codes.length; i++) {
      var m = codes[i].textContent.match(/\n/g);
      var loc = 1;
      if(m !== null)
        loc += m.length;
      codes[i].style.height = 14 * loc + "px";
      var code = ace.edit(codes[i]);
      code.setTheme("ace/theme/monokai");
      code.getSession().setMode("ace/mode/" + params.lang);
      code.setReadOnly(true);
      code.renderer.setShowGutter(false);
      function click(code) {
        return function() {
          editor.insert(code.getValue() + '\n');
        }
      }
      codes[i].ondblclick = click(code);
      if(codes[i].classList.contains("test"))
        codes[i].style.display = "none";
    }
  };
}

openFile(params.tuto);
