import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios from 'axios';
import { PaystackConfiguration } from 'src/config/configuration';

@Injectable()
export class ListService {
  constructor(
    @Inject(PaystackConfiguration.KEY)
    private readonly paystackConfig: ConfigType<typeof PaystackConfiguration>,
  ) {}

  async fetchBanks() {
    const response = await axios.get(`${this.paystackConfig.baseUrl}/bank`, {
      headers: {
        Authorization: `Bearer ${this.paystackConfig.secretKey}`,
      },
    });
    return response.data;
  }
}
