#!/bin/sh

shopt -s nullglob >/dev/null 2>&1 || true
shwordsplit >/dev/null 2>&1 || true

PATH=/opt/nodejs/bin:$PATH
export PATH

#dir="$(dirname "$(realpath "$0")")"
dir="$(cd "$(dirname "$0")"; pwd -P)"

if md5 -s x >/dev/null 2>&1; then
    get_md5(){(
	f="$1"
	md5 -q "$f"
    )}
elif md5sum --help >/dev/null 2>&1; then
    get_md5(){(
	f="$1"
        cat "$f" | md5sum -b - | awk '{print$1}'
    )}
elif openssl --help >/dev/null 2>&1; then
    get_md5(){(
	f="$1"
        cat "$f" | openssl md5
    )}
else
    echo "md5 utility not found" 1>&2
    exit 1
fi

fix_names(){(
  no_dry_run=echo
  if [ "--no-dry-run" = "$1" ]; then no_dry_run="sh -x -c"; shift; fi
  for f in "$@"
  do
    if [ -f "$f" ]; then
      md5=$(get_md5 "$f")
      typ=$(identify "$f" | awk '{print$2}' | tr A-Z a-z)
      n="$md5.$typ"
      if [ -f "$n" ]; then
	$no_dry_run "rm -fv '$f'"
      else
        test "$f" -ef "$n" || $no_dry_run "mv -v '$f' '$n'"
      fi
    fi
  done
)}

scan_url(){(
  url="$1";shift
  case "$url" in
    http:*|https:*)
      echo "### URL: [$url] ###" 1>&2
      $dir/page-pictures.casper.js "$url" </dev/null
      ;;
    magnet:*)
      surl=$(echo "$url" |cut -c1-40)
      echo "### MAGNET: [$surl] ###"
      transmission-remote -a "$url" </dev/null
      ;;
    *)
      echo "### No URL: [$url] ###" 1>&2
      sleep 2
      ;;
  esac
)}

# echo $( xclip -out 2>/dev/null ) 하면 자연스럽게 '\n' 붙일 수 있다.
if pbpaste -help 2>/dev/null; then
    _peek(){
      echo "$(pbpaste)"
    }
else
    if [ ! -z "$DISPLAY" ]; then
	_peek(){
	  IFS= read url
	  echo $url
	}
    else
	_peek(){
          echo "$(xclip -target STRING -selection primary)" # 왠지모르지만 url 은 STRING ( default )
        }
    fi
fi

while :
do
  url=$(_peek)
  if [ -z "$url" -o "$urlprev" = "$url" ]
  then sleep 2
  else
    urlprev="$url"
    scan_url "$url"
    fix_names --no-dry-run ./*.jpg ./*.jpeg ./*.png
    echo "### Listening..." 1>&2
  fi
done
