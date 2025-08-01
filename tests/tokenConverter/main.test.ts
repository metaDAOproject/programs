import initializeTokenConverterConfig from "./unit/initializeTokenConverterConfig.test.js";
import initializeTokenConverter from "./unit/initializeTokenConverter.test.js";
import convert from "./unit/convert.test.js";
import errorHandling from "./unit/errorHandling.test.js";

export default function suite() {
  describe("#initialize_token_converter_config", initializeTokenConverterConfig);
  describe("#initialize_token_converter", initializeTokenConverter);
  describe("#convert", convert);
  describe("#error_handling", errorHandling);
} 