:

shwordsplit 2>/dev/null

dir=$( dirname $( realpath "$0" ) )
script=page-pictures.casper.js

options=
options="$options --web-security=false"
#options="$options --proxy=127.0.0.1:9050 --proxy-type=socks5"
options="$options --verbose --log-level=info"

#echo "dir=$dir script=$script" 1>&2

while [ ! -z "$1" ]
do
  arg="$1"
  shift
  case "$arg" in
    1) url="http://blog.daum.net/_blog/BlogTypeView.do?blogid=0q54d&articleno=122&categoryId=6&regdt=20151115081548&totalcnt=25" ;;
    2) url="http://seokblog.tistory.com/117" ;;
    3) url="http://seokblog.tistory.com/118" ;;
    4) url="http://quasarzone.co.kr/bbs/board.php?bo_table=qb_image&wr_id=91" ;;
    5) url="http://aion.plaync.com/board/server/view?articleID=3103823&page=&rootCategory=28&category=1411" ;;
    6) url="http://tcafeuu.com/bbs/board.php?bo_table=c_jjalbang&wr_id=97970" ;;
    7) url="http://www.onlifezone.com/soul/textyle/14914311" ;;
    8) url="https://tailstar.net/index.php?mid=gallery_enter&document_srl=1746645&cpage=1" ;;
  esac
  casperjs $options "$dir/$script" "$url"
done
