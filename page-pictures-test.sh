:

dir=$( dirname $( realpath "$0" ) )

while [ ! -z "$1" ]
do
  arg="$1"
  shift
  case "$arg" in
    1) casperjs "$dir/page-pictures.js" "http://blog.daum.net/_blog/BlogTypeView.do?blogid=0q54d&articleno=122&categoryId=6&regdt=20151115081548&totalcnt=25" ;;
    2) casperjs "$dir/page-pictures.js" "http://seokblog.tistory.com/117" ;;
    3) casperjs "$dir/page-pictures.js" "http://seokblog.tistory.com/118" ;;
    4) casperjs "$dir/page-pictures.js" "http://quasarzone.co.kr/bbs/board.php?bo_table=qb_image&wr_id=91" ;;
  esac
done

