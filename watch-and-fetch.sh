#!/bin/sh
shwordsplit >/dev/null 2>&1 || true

PATH=/opt/nodejs/bin:$PATH
export PATH

dir="$(dirname "$(realpath "$0")")"

fix_names(){(
  no_dry_run=echo
  if [ "--no-dry-run" = "$1" ]; then no_dry_run="sh -x -c"; shift; fi
  for f in "$@"
  do
    if [ -f "$f" ]; then
      md5=$( cat "$f" | md5sum -b - | awk '{print$1}' )
      typ=$( identify "$f" | awk '{print$2}' | tr A-Z a-z )
      n="$md5.$typ"
      test "$f" -ef "$n" || $no_dry_run "mv -v '$f' '$md5.$typ'"
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

if [ -z "$DISPLAY" ]; then
  while IFS= read url
  do
    scan_url "$url"
    fix_names --no-dry-run ./*.jpg ./*.jpeg ./*.png
    echo "### Listening..." 1>&2
  done
else
  #XCLIPCMD="xclip -target text/plain -selection primary -display '$DISPLAY'"
  XCLIPCMD="xclip -target STRING -selection primary" # 왠지모르지만 url 은 STRING ( default )
  while :
  do
    # 주의: IFS= read 를 사용할 때는 입력에 반드시 '\n' 있어야 하더라
    #   echo $( xclip -out 2>/dev/null ) 하면 자연스럽게 '\n' 붙일 수 있다.
    url=$( $XCLIPCMD -out 2>/dev/null )
    if [ -z "$url" -o "$urlprev" = "$url" ]
    then sleep 2
    else
      urlprev="$url"
      scan_url "$url"
      fix_names --no-dry-run ./*.jpg ./*.jpeg ./*.png
      echo "### Listening..." 1>&2
    fi
  done
fi
