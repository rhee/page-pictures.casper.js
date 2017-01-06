#!/bin/sh

#PATH=/opt/nodejs/bin:$PATH
#export PATH

##################################################
# BEGIN check required programs installed or not
##################################################

(
  IFS=:
  #pre_check_list="node -v:openssl version:realpath -h:identify -version:phantomjs -v:casperjs --version"
  #pre_check_list="node -v:openssl version:realpath -h:identify -version"
  pre_check_list="node -v:openssl version:identify -version"
  for cmd in $pre_check_list
  do
    if ! eval "$cmd" >/dev/null 2>&1
    then
      echo "command not found: $cmd" 1>&2
      exit 1
    fi
  done
) || exit 1

##################################################
# END check required programs installed or not
##################################################

if realpath -h >/dev/null 2>&1
then
  dir="$(dirname "$(realpath "$0")")"
else
  dir="$(cd "$(dirname "$(which "$0")")"; pwd -P)"
fi

echo "[watch-and-fetch] dir=" $dir 1>&2

fix_names(){(

  shopt -s nullglob >/dev/null 2>&1 || true
  shwordsplit >/dev/null 2>&1 || true

  no_dry_run=echo
  if [ "--no-dry-run" = "$1" ]; then no_dry_run="sh -x -c"; shift; fi
  for f in "$@"
  do
    if [ -f "$f" ]; then
      md5=$(openssl md5 "$f" | awk '{print$2}')
      typ=$(identify "$f" | awk '{print$2}' | tr A-Z a-z)
      n="$md5.$typ"
      if [ ! "$f" -ef "$n" ]; then
	if test -f "$n"; then
	  $no_dry_run "rm -fv '$f'"
	else
	  $no_dry_run "mv -v '$f' '$n'"
	fi
      fi
    fi
  done
)}

scan_url(){(
  url="$1";shift
  case "$url" in
    http:*|https:*)
      echo "### URL: [$url] ###" 1>&2
      output_dir=$PWD
      #(set -x; cd $dir; casperjs --web-security=false --ignore-ssl-errors=true --verbose --log-level=info page-pictures.casper.js "$url" --output-dir="$output_dir") </dev/null
      (set -x; cd $dir; npm start -- "$url" --output-dir="$output_dir") </dev/null
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

if pbpaste -help 2>/dev/null; then
    _peek(){
      echo "$(pbpaste)"
    }
else
    if [ -z "$DISPLAY" ]; then
	_peek(){
	  IFS= read url
	  echo $url
	}
    else
	_peek(){
	  echo "$(xclip -out -target STRING -selection primary </dev/null 2>/dev/null)" # 왠지모르지만 url 은 STRING ( default )
        }
    fi
fi


# fork 1

(

  urlprev=
  while :
  do
    url=$(_peek)
    case "$url" in
      $urlprev)
	sleep 1
	;;
      http://*|https://*|magnet:*)
	echo "$url" >> .history
	echo "$url" >> .queue
        echo "[queued] $url" 1>&2
	;;
    esac
    urlprev="$url"
  done

) &

child_pid=$!
trap "kill -9 $child_pid || true; exit 1" KILL TERM INT

# parent loop
while :
do

  if [ -f .queue ]
  then

    # atomic mv
    mv .queue .queue.tmp

    # get unique entries
    sort -u < .queue.tmp > .queue.work
    rm -f .queue.tmp

    # read and handle queued urls
    cat .queue.work | while read url; do scan_url "$url"; done

    fix_names --no-dry-run ./*.jpg ./*.jpeg ./*.png ./*.JPG ./*.JPEG ./*.PNG ./*.gif ./*.GIF
    rm -f .queue.work

  fi

  sleep 5

done
