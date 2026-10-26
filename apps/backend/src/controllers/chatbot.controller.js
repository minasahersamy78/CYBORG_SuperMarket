const emailService = require('../modules/email/email.service');
const recommendationsService = require('../modules/recommendations/recommendations.service');
const aiEngineService = require('../modules/ai-engine/ai-engine.service');

const ChatbotController = {
  processQuery(query) {
    return aiEngineService.parseVoiceOrTextQuery(query);
  },
  parseDuration(text) {
    return recommendationsService.parseDuration(text);
  },
  buildSmartBasket(options) {
    return recommendationsService.buildBasket(options);
  },
  sendFeedback(data, recipient = 'cyborgcoding1@gmail.com') {
    return emailService.sendChatbotFeedback(data, recipient);
  }
};

module.exports = ChatbotController;
