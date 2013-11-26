all: ocaml-worker.js python-worker editor

ocaml-worker.js: js_of_ocaml
	make -C js_of_ocaml
	make -C js_of_ocaml/toplevel
	-mkdir ocaml
	cp js_of_ocaml/toplevel/toplevel.js ocaml-worker.js

python-worker.js: empythoned
	(cd empythoned && exec ./build)
	cp empythoned/dist/python.opt.js .
	cp -r empythoned/dist/lib .
	cp empythoned/worker.js python-worker.js

editor: ace
	(cd ace && exec npm install)
	(cd ace && exec node Makefile.dryice.js --m --nc)
	cp -r ace/build/src-min-noconflict editor
