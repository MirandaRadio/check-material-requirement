
const reqData = require('../data/requirements.json');
const { getMaterialMetadata, parseNum, isAspectRatioInRange } = require('./utils');
const FileType = require('file-type');

// Función para normalizar MIME types y manejar eq      // COMPROBACIÓN DEL MÍNIMO Y MÁXIMO DEL BIT-RATE
      const minBitRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_bit_rate') || {}).meta_value || 0);
      const maxBitRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_bit_rate') || {}).meta_value || 0);
      if (!!minBitRate || !!maxBitRate) {
        // Para audio, convertir los límites de Mbps a kbps para comparación correcta
        let actualBitRate = bit_rate;
        let minLimit = minBitRate;
        let maxLimit = maxBitRate;
        let unit = 'Mbps';
        
        if (isAudioOnly) {
          // Los archivos de audio ya están en kbps, pero los límites podrían estar en Mbps
          // Si el límite máximo es menor que el bit-rate, probablemente los límites están en Mbps
          if (maxBitRate > 0 && maxBitRate < bit_rate && bit_rate > 50) {
            // Convertir límites de Mbps a kbps
            minLimit = minBitRate * 1000;
            maxLimit = maxBitRate * 1000;
          }
          unit = 'kbps';
        }
        
        requirements.push({
          title: 'Bit-Rate',
          type: 'bit_rate',
          status: actualBitRate >= minLimit && actualBitRate <= maxLimit,
          value: `${actualBitRate} ${unit}`,
          allowed: [ `${minLimit} ${unit} Mínimo.`, `${maxLimit} ${unit} Máximo.`]
        });
      }function normalizeMimeType(mimeType) {
  const equivalences = {
    'audio/mpeg': 'audio/mp3', // audio/mpeg es equivalente a audio/mp3
    'audio/mp3': 'audio/mp3', // audio/mp3 permanece igual
    'video/quicktime': 'video/mov' // .mov files
  };

  return equivalences[mimeType] || mimeType;
}

// Función para verificar si un MIME type es válido considerando equivalencias
function isMimeTypeValid(detectedMime, allowedMimes) {
  const normalizedDetected = normalizeMimeType(detectedMime);
  const normalizedAllowed = allowedMimes.map(mime => normalizeMimeType(mime));

  return normalizedAllowed.includes(normalizedDetected) || allowedMimes.includes(detectedMime);
}

async function checkRequirementsMaterial(file, setBufferFile, detailFormat) {

  try {
    if (!file.path) {
      throw new Error('No se ha podido recuperar el fichero para poder continuar.');
    }
    if (!detailFormat.id_media) {
      throw new Error('No se ha podido recuperar el formato del material.');
    }
    if (!setBufferFile) {
      throw new Error('No se ha podido recuperar el material.');
    }
    const requirements = [];

    if ([14, 22].includes(detailFormat.id_media)) {
      // REDES SOCIALES, ANUNCIOS EXTERNOS
      const getSubmediaRequirements = reqData[detailFormat.id_placement];
      if (getSubmediaRequirements instanceof Promise) {
        getSubmediaRequirements = await getSubmediaRequirements;
      }
      if (!getSubmediaRequirements || getSubmediaRequirements.length === 0) {
        throw new Error(`No se ha podido recuperar los requisitos del formato. Formato: ${detailFormat.id_placement}`);
      }

      // INFORMACIÓN GENERAL DE LOS METADATOS DE UN MATERIAL SUBIDO.
      const responseMetadata = await getMaterialMetadata(file.path);

      const { width, height, duration, frame_rate, aspect_ratio, codec_video, coded_audio, bit_rate, sample_rate, channels } = responseMetadata.data;

      // Determinar si es un archivo de audio puro
      const isAudioOnly = width === null && height === null;

      // ####################################################################
      // COMPROBACION DE LAS EXTENSIONES PERMITIDAS.
      const avaliableExtension = [...new Set(getSubmediaRequirements.filter(x => x.meta_key == 'mime_type').map(x => x.meta_value))];
      if (avaliableExtension.length > 0) {
        const { ext, mime } = await FileType.fromBuffer(setBufferFile);
        const isValidMime = isMimeTypeValid(mime, avaliableExtension);
        requirements.push({
          title: 'Extensiones',
          type: 'mime_type',
          status: isValidMime,
          value: mime,
          allowed: avaliableExtension
        });
      }

      // ####################################################################
      // COMPROBACIÓN DE TAMAÑO.
      const maxSize = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_size_mb') || {}).meta_value || 0);
      const minSize = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_size_mb') || {}).meta_value || 0);
      if (!!minSize || !!maxSize) {
        const setFinalSizeMb = file.size / 1024 / 1024;
        requirements.push({
          title: 'Tamaños',
          type: 'size',
          status: setFinalSizeMb >= minSize && setFinalSizeMb <= maxSize,
          value: `${parseNum(setFinalSizeMb, 2)}MB`,
          allowed: [`${minSize}MB mínimo.`, `${maxSize}MB máximo.`]
        });
      }

      // ####################################################################
      // COMPROBACIÓN DE LA RESOLUCIÓN (solo para videos e imágenes).
      if (!isAudioOnly) {
        const maxHeigthHorizontal = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_height_horizontal_px') || {}).meta_value || 0);
        const maxWidthHorizontal = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_width_horizontal_px') || {}).meta_value || 0);
        const maxHeigthVertical = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_height_vertical_px') || {}).meta_value || 0);
        const maxWidthVertical = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_width_vertical_px') || {}).meta_value || 0);

        if (!!maxHeigthHorizontal || !!maxWidthHorizontal || !!maxHeigthVertical || !!maxWidthVertical) {
          requirements.push({
            title: 'Resoluciones',
            type: 'resolution',
            status: width <= maxWidthHorizontal && height <= maxHeigthHorizontal || width <= maxWidthVertical && height <= maxHeigthVertical,
            value: `Ancho ${width} y Alto ${height}`,
            allowed: [`Horizontal ancho máximo ${maxWidthHorizontal}px.`, `Horizontal alto máximo ${maxHeigthHorizontal}px.`, `Vertical ancho máximo ${maxWidthVertical}px.`, `Vertical alto máximo ${maxHeigthVertical}px.`] });
        }

        // COMPRBACIÓN MÍNIMA DE TAMAÑOS. 
        const minHeight = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_height') || {}).meta_value || 0);
        const minWidth = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_width') || {}).meta_value || 0);
        if (!!minHeight || !!minWidth) {
          requirements.push({
            title: 'Tamaños mínimos',
            type: 'min_size',
            status: width >= minWidth && height >= minHeight,
            value: `Ancho ${width} y Alto ${height}`,
            allowed: [`${minWidth}px Ancho mínimo.`, `${minHeight}px Alto mínimo.`]
          });
        }
      }

      // COMPROBACIÓN DE LA DURACIÓN DEL MATERIAL
      const minDuration = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_duration') || {}).meta_value || 0);
      const maxDuration = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_duration') || {}).meta_value || 0);
      if (!!minDuration || !!maxDuration) {
        requirements.push({
          title: 'Duración',
          type: 'duration',
          status: duration >= minDuration && duration <= maxDuration,
          value: `${parseNum(duration, 2)} Segundos.`,
          allowed: [`${minDuration} segundos mínimos.`, `${maxDuration} segundos máximos.`]
        });
      }

      // COMPROBACIÓN DE LOS FRAMES POR SEGUNDOS (FPS) - solo para videos
      if (!isAudioOnly) {
        const minFrameRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_frame_rate') || {}).meta_value || 0);
        const maxFrameRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_frame_rate') || {}).meta_value || 0);
        if (!!minFrameRate || !!maxFrameRate) {
          requirements.push({
            title: 'Frames por segundo',
            type: 'frame_rate',
            status: frame_rate >= minFrameRate && frame_rate <= maxFrameRate,
            value: frame_rate,
            allowed: [`${minFrameRate} FPS Mínimo.`, `${maxFrameRate} FPS Máximos.`]
          });
        }
      }

      // COMPROBACIÓN ASPECT RATIO (solo para videos e imágenes).
      if (!isAudioOnly) {
        const avaliableAspectRatios = [...new Set(getSubmediaRequirements.filter(x => x.meta_key == 'aspect_ratio').map(x => x.meta_value))];
        if (avaliableAspectRatios.length > 0) {
          requirements.push({
            title: 'Aspect Ratio',
            type: 'aspect_ratio',
            status: avaliableAspectRatios.includes(aspect_ratio),
            value: aspect_ratio,
            allowed: avaliableAspectRatios
          });
        }

        // COMPROBACIÓN DE INTERVALOS DE ASPECT RATIO
        const minAspectRatio = (getSubmediaRequirements.find(x => x.meta_key == 'min_aspect_ratio') || {}).meta_value;
        const maxAspectRatio = (getSubmediaRequirements.find(x => x.meta_key == 'max_aspect_ratio') || {}).meta_value;
        if (!!minAspectRatio && !!maxAspectRatio) {
          const checkAspectRatio = isAspectRatioInRange(width, height, minAspectRatio, maxAspectRatio);
          requirements.push({
            title: 'Aspect Ratio Intervalos',
            type: 'aspect_ratio_interval',
            status: checkAspectRatio,
            value: `${aspect_ratio}, ${width}x${height}`,
            allowed: [`Intervalo de aspect ratio ${minAspectRatio} - ${maxAspectRatio}`]
          });
        }
      }

      // ####################################################################
      // VALIDACIONES ESPECÍFICAS PARA AUDIO
      if (isAudioOnly) {
        // COMPROBACIÓN DE SAMPLE RATE
        const minSampleRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_sample_rate') || {}).meta_value || 0);
        const maxSampleRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_sample_rate') || {}).meta_value || 0);
        if (!!minSampleRate || !!maxSampleRate) {
          requirements.push({
            title: 'Sample Rate',
            type: 'sample_rate',
            status: sample_rate >= minSampleRate && sample_rate <= maxSampleRate,
            value: `${sample_rate} Hz`,
            allowed: [`${minSampleRate} Hz Mínimo.`, `${maxSampleRate} Hz Máximo.`]
          });
        }

        // COMPROBACIÓN DE CANALES
        const minChannels = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_channels') || {}).meta_value || 0);
        const maxChannels = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_channels') || {}).meta_value || 0);
        if (!!minChannels || !!maxChannels) {
          requirements.push({
            title: 'Canales de Audio',
            type: 'channels',
            status: channels >= minChannels && channels <= maxChannels,
            value: channels,
            allowed: [`${minChannels} canales mínimo.`, `${maxChannels} canales máximo.`]
          });
        }
      }

      // COMPROBACIÓN DE LOS CODEC DE VIDEOS (solo para videos).
      if (!isAudioOnly) {
        const avaliableCodecVideos = [...new Set(getSubmediaRequirements.filter(x => x.meta_key == 'codec_video').map(x => String(x.meta_value).trim().toLowerCase()))];
        if (avaliableCodecVideos.length > 0) {
          requirements.push({
            title: 'Codec Video',
            type: 'codec_video',
            status: avaliableCodecVideos.includes(codec_video),
            value: codec_video,
            allowed: avaliableCodecVideos
          });
        }
      }

      // COMPROBACIÓN DE LOS CODEC DE AUDIOS.
      const avaliableCodecAudios = [...new Set(getSubmediaRequirements.filter(x => x.meta_key == 'codec_audio').map(x => String(x.meta_value).trim().toLowerCase()))];
      if (avaliableCodecAudios.length > 0) {
        requirements.push({
          title: 'Codec Audio',
          type: 'codec_audio',
          status: avaliableCodecAudios.includes(coded_audio),
          value: coded_audio,
          allowed: avaliableCodecAudios
        });
      }

      // COMPROBACIÓN DEL MÍNIMO Y MÁXIMO DEL BIT-RATE
      const minBitRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'min_bit_rate') || {}).meta_value || 0);
      const maxBitRate = parseFloat((getSubmediaRequirements.find(x => x.meta_key == 'max_bit_rate') || {}).meta_value || 0);
      if (!!minBitRate || !!maxBitRate) {
        requirements.push({
          title: 'Bit-Rate',
          type: 'bit_rate',
          status: bit_rate >= minBitRate && bit_rate <= maxBitRate,
          value: bit_rate,
          allowed: [`${minBitRate} Bitrate Mínimo.`, `${maxBitRate} Bitrate Máximo.`]
        });
      }
    }
    return requirements;
  } catch (error) {
    console.log(error);
    throw new Error('No se ha podido leer el archivo del material.');
  }
}

module.exports = { checkRequirementsMaterial };