/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import {Live2DCubismFramework as acubismmotion} from './acubismmotion';
import {Live2DCubismFramework as cubismjson} from '../utils/cubismjson';
import {Live2DCubismFramework as cubismid} from '../id/cubismid';
import {Live2DCubismFramework as cubismframework} from '../live2dcubismframework';
import {Live2DCubismFramework as cubismmodel} from '../model/cubismmodel';
import {Live2DCubismFramework as cubismmotionqueueentry} from './cubismmotionqueueentry';
import {Live2DCubismFramework as csmvector} from '../type/csmvector';
import JsonFloat = cubismjson.JsonFloat;
import csmVector = csmvector.csmVector;
import CubismMotionQueueEntry = cubismmotionqueueentry.CubismMotionQueueEntry;
import CubismModel = cubismmodel.CubismModel;
import CubismFramework = cubismframework.CubismFramework;
import CubismIdHandle = cubismid.CubismIdHandle;
import CubismJson = cubismjson.CubismJson;
import Value = cubismjson.Value;
import ACubismMotion = acubismmotion.ACubismMotion;

export namespace Live2DCubismFramework
{
    // exp3.jsonのキーとデフォルト
    const ExpressionKeyFadeIn: string = "FadeInTime";
    const ExpressionKeyFadeOut: string = "FadeOutTime";
    const ExpressionKeyParameters: string = "Parameters";
    const ExpressionKeyId: string = "Id";
    const ExpressionKeyValue: string = "Value";
    const ExpressionKeyBlend: string = "Blend";
    const BlendValueAdd: string = "Add";
    const BlendValueMultiply: string = "Multiply";
    const BlendValueOverwrite: string = "Overwrite";
    const DefaultFadeTime: number = 1.0;

    /**
     * 表情のモーション
     *
     * 表情のモーションクラス。
     */
    export class CubismExpressionMotion extends ACubismMotion
    {
        /**
         * インスタンスを作成する。
         * @param buffer expファイルが読み込まれているバッファ
         * @param size バッファのサイズ
         * @return 作成されたインスタンス
         */
        public static create(buffer: ArrayBuffer, size: number): CubismExpressionMotion
        {
            let expression: CubismExpressionMotion = new CubismExpressionMotion();

            let json: CubismJson = CubismJson.create(buffer, size);
            let root: Value = json.getRoot();

            expression.setFadeInTime(root.getValueByString(ExpressionKeyFadeIn).toFloat(DefaultFadeTime));  // フェードイン
            expression.setFadeOutTime(root.getValueByString(ExpressionKeyFadeOut).toFloat(DefaultFadeTime)); // フェードアウト

            // 各パラメータについて
            const parameterCount = root.getValueByString(ExpressionKeyParameters).getSize();
            expression._parameters.prepareCapacity(parameterCount);

            for(let i: number = 0; i < parameterCount; ++i)
            {
                let param: Value = root.getValueByString(ExpressionKeyParameters).getValueByIndex(i);
                const parameterId: CubismIdHandle = CubismFramework.getIdManager().getId(param.getValueByString(ExpressionKeyId).getRawString());  // パラメータID

                const value: number = param.getValueByString(ExpressionKeyValue).toFloat(); // 値

                // 計算方法の設定
                let blendType: ExpressionBlendType;

                if(param.getValueByString(ExpressionKeyBlend).isNull() || param.getValueByString(ExpressionKeyBlend).getString() == BlendValueAdd)
                {
                    blendType = ExpressionBlendType.ExpressionBlendType_Add;
                }
                else if(param.getValueByString(ExpressionKeyBlend).getString() == BlendValueMultiply)
                {
                    blendType = ExpressionBlendType.ExpressionBlendType_Multiply;
                }
                else if(param.getValueByString(ExpressionKeyBlend).getString() == BlendValueOverwrite)
                {
                    blendType = ExpressionBlendType.ExpressionBlendType_Overwrite;
                }
                else
                {
                    // その他 仕様にない値を設定した時は加算モードにすることで復旧
                    blendType = ExpressionBlendType.ExpressionBlendType_Add;
                }

                // 設定オブジェクトを作成してリストに追加する
                let item: ExpressionParameter = new ExpressionParameter();

                item.parameterId = parameterId;
                item.blendType = blendType;
                item.value = value;

                expression._parameters.pushBack(item);
            }

            CubismJson.delete(json);    // JSONデータは不要になったら削除する
            return expression;
        }

        /**
         * モデルのパラメータの更新の実行
         * @param model 対象のモデル
         * @param userTimeSeconds デルタ時間の積算値[秒]
         * @param weight モーションの重み
         * @param motionQueueEntry CubismMotionQueueManagerで管理されているモーション
         */
        public doUpdateParameters(model: CubismModel, userTimeSeconds: number, weight: number, motionQueueEntry: CubismMotionQueueEntry): void
        {
            for(let i: number = 0; i < this._parameters.getSize(); ++i)
            {
                let parameter: ExpressionParameter = this._parameters.at(i);

                switch(parameter.blendType)
                {
                case ExpressionBlendType.ExpressionBlendType_Add:
                    {
                        model.addParameterValueById(parameter.parameterId, parameter.value, weight);
                        break;
                    }
                case ExpressionBlendType.ExpressionBlendType_Multiply:
                    {
                        model.multiplyParameterValueById(parameter.parameterId, parameter.value, weight);
                        break;
                    }
                case ExpressionBlendType.ExpressionBlendType_Overwrite:
                    {
                        model.setParameterValueById(parameter.parameterId, parameter.value, weight)
                        break;
                    }
                default:
                    // 仕様にない値を設定した時はすでに加算モードになっている
                    break;
                }
            }
        }

        /**
         * コンストラクタ
         */
        constructor()
        {
            super();

            this._parameters = new csmVector<ExpressionParameter>();
        }

        _parameters: csmVector<ExpressionParameter>;  // 表情のパラメータ情報リスト
    }

    /**
     * 表情パラメータ値の計算方式
     */
    export enum ExpressionBlendType
    {
        ExpressionBlendType_Add = 0,        // 加算
        ExpressionBlendType_Multiply = 1,   // 乗算
        ExpressionBlendType_Overwrite = 2   // 上書き
    }

    /**
     * 表情のパラメータ情報
     */
    export class ExpressionParameter
    {
        parameterId: CubismIdHandle;          // パラメータID
        blendType: ExpressionBlendType; // パラメータの演算種類
        value: number;                  // 値
    }
}
