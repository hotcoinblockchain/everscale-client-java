package com.radiance.tonclient;

import java.util.concurrent.CompletableFuture;
import java.util.stream.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Arrays;

/**
 *  
 */
public class Utils {

    public static abstract class AddressStringFormat {

        public static final AccountId AccountId = new AccountId();

    /**
     *  
     */
    public static class AccountId extends AddressStringFormat  {

        public AccountId() {

        }



        @Override
        public String toString() {
            return "{"+"\"type\":\"AccountId\""+"}";
        }
    }

        public static final Hex Hex = new Hex();

    /**
     *  
     */
    public static class Hex extends AddressStringFormat  {

        public Hex() {

        }



        @Override
        public String toString() {
            return "{"+"\"type\":\"Hex\""+"}";
        }
    }

    /**
     *  
     */
    public static class Base64 extends AddressStringFormat  {

        public Base64(Boolean url, Boolean test, Boolean bounce) {

            this.url = url;

            this.test = test;

            this.bounce = bounce;

        }
        public Base64(Boolean url, Boolean test) {

            this.url = url;

            this.test = test;

        }
        public Base64(Boolean url) {

            this.url = url;

        }
        public Base64() {

        }


        @JsonProperty("url")
        private Boolean url;
        /**
         * 
         */
        public Boolean getUrl() {
            return url;
        }
        /**
         * 
         */
        public void setUrl(Boolean value) {
            this.url = value;
        }

        @JsonProperty("test")
        private Boolean test;
        /**
         * 
         */
        public Boolean getTest() {
            return test;
        }
        /**
         * 
         */
        public void setTest(Boolean value) {
            this.test = value;
        }

        @JsonProperty("bounce")
        private Boolean bounce;
        /**
         * 
         */
        public Boolean getBounce() {
            return bounce;
        }
        /**
         * 
         */
        public void setBounce(Boolean value) {
            this.bounce = value;
        }


        @Override
        public String toString() {
            return "{"+Stream.of("\"type\":\"Base64\"",(url==null?null:("\"url\":"+url)),(test==null?null:("\"test\":"+test)),(bounce==null?null:("\"bounce\":"+bounce))).filter(_f -> _f != null).collect(Collectors.joining(","))+"}";
        }
    }
}
    private TONContext context;

    public Utils(TONContext context) {
        this.context = context;
    }

   /**
    * 
    *
    * @param address 
    * @param outputFormat 
    */
    public CompletableFuture<String> convertAddress(String address, AddressStringFormat outputFormat) {
        return context.requestJSON("utils.convert_address", "{"+Stream.of((address==null?null:("\"address\":\""+address+"\"")),(outputFormat==null?null:("\"output_format\":"+outputFormat))).filter(_f -> _f != null).collect(Collectors.joining(","))+"}")
            .thenApply(json -> TONContext.convertValue(json.findValue("address"), String.class));
    }

   /**
    * 
    *
    * @param account 
    * @param period 
    */
    public CompletableFuture<String> calcStorageFee(String account, Number period) {
        return context.requestJSON("utils.calc_storage_fee", "{"+Stream.of((account==null?null:("\"account\":\""+account+"\"")),(period==null?null:("\"period\":"+period))).filter(_f -> _f != null).collect(Collectors.joining(","))+"}")
            .thenApply(json -> TONContext.convertValue(json.findValue("fee"), String.class));
    }

}
