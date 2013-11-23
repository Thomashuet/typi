all:
	make -C js_of_ocaml
	make -C js_of_ocaml/toplevel
	cp js_of_ocaml/toplevel/toplevel.js ocaml/toplevel.js
