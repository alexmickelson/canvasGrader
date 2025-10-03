#!/bin/bash

docker build -t sandbox -f sandbox.Dockerfile .
docker run --privileged -it --rm sandbox
