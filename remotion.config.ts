import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setOverwriteOutput(true);

// Windows 로컬 미리보기용. Linux(Routine 클라우드)에서는 'swangle' 또는 기본값을 사용한다.
Config.setChromiumOpenGlRenderer('angle');
