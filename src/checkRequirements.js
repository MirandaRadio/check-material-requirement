
const reqData = require('../data/requirements.json');
const { getMaterialMetadata, parseNum, isAspectRatioInRange } = require('./utils');
const FileType = require('file-type');

async function checkRequirementsMaterial(file, setBufferFile, detailFormat) {

  try {
    if(!file.path){ throw new Error('No se ha podido recuperar el fichero para poder continuar.') }
    if(!detailFormat.id_media){ throw new Error('No se ha podido recuperar el formato del material.') }
    if(!setBufferFile){ throw new Error('No se ha podido recuperar el material.') }
    const requirements = []

    if([14, 22].includes(detailFormat.id_media)){ // REDES SOCIALES, ANUNCIOS EXTERNOS
      const getSubmediaRequirements = reqData[detailFormat.id_placement];
      if (getSubmediaRequirements instanceof Promise) {
        getSubmediaRequirements = await getSubmediaRequirements;
      }
      if(!getSubmediaRequirements || getSubmediaRequirements.length === 0){
        throw new Error('No se ha podido recuperar los requisitos del formato.')
      }


      // INFORMACIÓN GENERAL DE LOS METADATOS DE UN MATERIAL SUBIDO.
      const responseMetadata = await getMaterialMetadata(file.path)

      const { width, height, duration, frame_rate, aspect_ratio, codec_video, coded_audio, bit_rate } = responseMetadata.data

      // ####################################################################
      // COMPROBACION DE LAS EXTENSIONES PERMITIDAS.
      const avaliableExtension = [...new Set(getSubmediaRequirements.filter(x => x.meta_key == 'mime_type').map(x => x.meta_value))]
      if(avaliableExtension.length > 0){
        const { ext, mime } = await FileType.fromBuffer(setBufferFile)
        requirements.push({
          title: 'Extensiones',
          type: 'mime_type',
          status: avaliableExtension.includes(mime),
          value: mime,
          allowed: avaliableExtension
        })
      }

      // ####################################################################
      // COMPROBACIÓN DE TAMAÑO.
      const maxSize = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_size_mb') || {}).meta_value || 0)
      const minSize = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_size_mb') || {}).meta_value || 0)
      if(!!minSize || !!maxSize){
        const setFinalSizeMb = (file.size / 1024) / 1024
        requirements.push({
          title: 'Tamaños',
          type: 'size',
          status: setFinalSizeMb >= minSize && setFinalSizeMb <= maxSize,
          value: `${parseNum(setFinalSizeMb, 2)}MB`,
          allowed: [ `${minSize}MB mínimo.`, `${maxSize}MB máximo.`]
        })
      }

      // ####################################################################
      // COMPROBACIÓN DE LA RESOLUCIÓN.
      const maxHeigthHorizontal = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_height_horizontal_px') || {}).meta_value || 0)
      const maxWidthHorizontal = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_width_horizontal_px') || {}).meta_value || 0)
      const maxHeigthVertical = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_height_vertical_px') || {}).meta_value || 0)
      const maxWidthVertical = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_width_vertical_px') || {}).meta_value || 0)

      if((!!maxHeigthHorizontal || !!maxWidthHorizontal) || (!!maxHeigthVertical || !!maxWidthVertical)){
        requirements.push({
          title: 'Resoluciones',
          type: 'resolution',
          status: (width <= maxWidthHorizontal && height <= maxHeigthHorizontal) || (width <= maxWidthVertical && height <= maxHeigthVertical),
          value: `Ancho ${width} y Alto ${height}`,
          allowed: [
            `Horizontal ancho máximo ${maxWidthHorizontal}px.`,
            `Horizontal alto máximo ${maxHeigthHorizontal}px.`,
            `Vertical ancho máximo ${maxWidthVertical}px.`,
            `Vertical alto máximo ${maxHeigthVertical}px.`
        ] })
      }

      // COMPRBACIÓN MÍNIMA DE TAMAÑOS. 
      const minHeight = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_height') || {}).meta_value || 0)
      const minWidth = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_width') || {}).meta_value || 0)
      if(!!minHeight || !!minWidth){
        requirements.push({
          title: 'Tamaños mínimos',
          type: 'min_size',
          status: width >= minWidth && height >= minHeight,
          value: `Ancho ${width} y Alto ${height}`,
          allowed: [ `${minWidth}px Ancho mínimo.`, `${minHeight}px Alto mínimo.`]
        })
      }

      // COMPROBACIÓN DE LA DURACIÓN DEL MATERIAL
      const minDuration = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_duration') || {}).meta_value || 0)
      const maxDuration = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_duration') || {}).meta_value || 0)
      if(!!minDuration || !!maxDuration){
        requirements.push({
          title: 'Duración',
          type: 'duration',
          status: duration >= minDuration && duration <= maxDuration,
          value: `${parseNum(duration, 2)} Segundos.`,
          allowed: [ `${minDuration} segundos mínimos.`, `${maxDuration} segundos máximos.`]
        })
      }

      // COMPROBACIÓN DE LOS FRAMES POR SEGUNDOS (FPS)
      const minFrameRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_frame_rate') || {}).meta_value || 0)
      const maxFrameRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_frame_rate') || {}).meta_value || 0)
      if(!!minFrameRate || !!maxFrameRate){
        requirements.push({
          title: 'Frames por segundo',
          type: 'frame_rate',
          status: (frame_rate >= minFrameRate && frame_rate <= maxFrameRate),
          value: frame_rate,
          allowed: [ `${minFrameRate} FPS Mínimo.`, `${maxFrameRate} FPS Máximos.`]
        })
      }

      // COMPROBACIÓN ASPECT RATIO.
      const avaliableAspectRatios = [...new Set(getSubmediaRequirements.filter(x => x.meta_key == 'aspect_ratio').map(x => x.meta_value))]
      if(avaliableAspectRatios.length > 0){
        requirements.push({
          title: 'Aspect Ratio',
          type: 'aspect_ratio',
          status: avaliableAspectRatios.includes(aspect_ratio),
          value: aspect_ratio,
          allowed: avaliableAspectRatios
        })

      }

      // COMPROBACIÓN DE INTERVALOS DE ASPECT RATIO
      const minAspectRatio = (getSubmediaRequirements.find(x => x.meta_key == 'min_aspect_ratio') || {}).meta_value
      const maxAspectRatio = (getSubmediaRequirements.find(x => x.meta_key == 'max_aspect_ratio') || {}).meta_value
      console.log('minAspectRatio', minAspectRatio, 'maxAspectRatio', maxAspectRatio);
      if(!!minAspectRatio && !!maxAspectRatio){
        const checkAspectRatio = isAspectRatioInRange(width, height, minAspectRatio, maxAspectRatio)
        requirements.push({
          title: 'Aspect Ratio Intervalos',
          type: 'aspect_ratio_interval',
          status: checkAspectRatio,
          value: `${aspect_ratio}, ${width}x${height}`,
          allowed: [ `Intervalo de aspect ratio ${minAspectRatio} - ${maxAspectRatio}`]
        })
      }

      // COMPROBACIÓN DE LOS CODEC DE VIDEOS,.
      const avaliableCodecVideos = [...new Set(getSubmediaRequirements.filter(x => x.meta_key == 'codec_video').map(x => String(x.meta_value).trim().toLowerCase()))]
      if(avaliableCodecVideos.length > 0){
        requirements.push({
          title: 'Codec Video',
          type: 'codec_video',
          status: avaliableCodecVideos.includes(codec_video),
          value: codec_video,
          allowed: avaliableCodecVideos
        })
      }

      // COMPROBACIÓN DE LOS CODEC DE AUDIOS.
      const avaliableCodecAudios = [...new Set(getSubmediaRequirements.filter(x => x.meta_key == 'codec_audio').map(x => String(x.meta_value).trim().toLowerCase()))]
      if(avaliableCodecAudios.length > 0){
        requirements.push({
          title: 'Codec Audio',
          type: 'codec_audio',
          status: avaliableCodecAudios.includes(coded_audio),
          value: coded_audio,
          allowed: avaliableCodecAudios
        })
      }

      // COMPROBACIÓN DEL MÍNIMO Y MÁXIMO DEL BIT-RATE
      const minBitRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_bit_rate') || {}).meta_value || 0)
      const maxBitRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_bit_rate') || {}).meta_value || 0)
      if(!!minBitRate || !!maxBitRate){
        requirements.push({
          title: 'Bit-Rate',
          type: 'bit_rate',
          status: bit_rate >= minBitRate && bit_rate <= maxBitRate,
          value: bit_rate,
          allowed: [ `${minBitRate} Bitrate Mínimo.`, `${maxBitRate} Bitrate Máximo.`]
        })
      }
    }
    return requirements 

  } catch (error) {
    console.log(error);
    throw new Error('No se ha podido leer el archivo del material.');
  }
}


module.exports = { checkRequirementsMaterial };
