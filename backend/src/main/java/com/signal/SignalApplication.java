package com.signal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SignalApplication {

	public static void main(String[] args) {
		SpringApplication.run(SignalApplication.class, args);
	}

}
