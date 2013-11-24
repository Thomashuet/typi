all: toplevel editor

toplevel:
	make -C js_of_ocaml
	make -C js_of_ocaml/toplevel
	-mkdir ocaml
	cp js_of_ocaml/toplevel/toplevel.js ocaml/toplevel.js

editor:
	(cd ace && exec npm install)
	(cd ace && exec node Makefile.dryice.js --m --nc)
	cp -r ace/build/src-min-noconflict editor
