:
shwordsplit >/dev/null 2>&1 || true
scan_url(){(
  url="$1";shift
  case "$url" in
    http:*|https:*)
      echo "### URL: [$url] ###" 1>&2
      page-pictures.casper.js "$url"
      ;;
    *)
      echo "### No URL: [$url] ###" 1>&2
      sleep 2
      ;;
  esac
)}
if [ -z "$DISPLAY" ]; then
  while IFS= read url
  do scan_url "$url"
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
      scan_url "$url"
      urlprev="$url"
    fi
  done
fi
