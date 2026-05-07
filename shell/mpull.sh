#!/bin/zsh
main="~/git"
npm i -g npm
for h in `ls $main`; do
  if [ -d ${main}/${h} ]; then
    cd ${main}/${h}
    echo
    echo npm update $h
    echo
    npm update
    echo
    echo git config pull.rebase false
    echo
    git config pull.rebase false
    echo
    echo git pull $h
    echo
    git pull
    echo
    cd $main
  fi
done
